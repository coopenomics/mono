/**
 * Сквозной прогон бака AXON на стенде (B2D-32, решение @ant 17.10.2026,
 * требование «Оплата документооборота: бак AXON, объём тарифа и кванты»).
 *
 * Тест ведёт кооператив partner1 через всю цепочку живого стенда тем путём,
 * которым ходят хаб и провайдер:
 *
 *   • выбор тарифа Стандарт у провайдера → четыре строки подписки пробными,
 *     с одной датой окончания (пробный период тарифа 150 / 16 = 9 дней);
 *   • пополнение биллинг-кошелька заявлением (billing::convert) — как в кабинете;
 *   • конец пробного периода: хаб платит сервер, поддержку и приложение
 *     (billing::pay), а документооборот — объёмом месяца через
 *     billing::converttoaxn: в баке +480 AXON, подписка продлена на месяц;
 *   • бак опустошается арендой ресурсов (powerup) ниже кванта → хаб на такте
 *     бака докупает квант 5 AXON за 50 ₽;
 *   • каталог провайдера отдаёт D на текущий месяц без округления.
 *
 * Сжатое время стенда: BILLING_PERIOD_MINUTES=30 у провайдера (день = 1 мин),
 * такты хаба — каждую минуту (BILLING_CRON_EXPRESSION, BILLING_PACKAGE_CRON_EXPRESSION).
 * Календарный месяц на стенде не виден — он живёт на условных 30 днях и
 * покрыт юнит-тестами провайдера.
 *
 * Требования к стенду: `EXTRA_RENT=1 pnpm run reboot:extra` (partner1 активен в
 * registrator.coops), провайдер поднят с пустой базой и недействительным ключом
 * Hostkey (аренда не нужна и не оплачивается). Переменные: CHAIN_URL, API_URL,
 * PROVIDER_URL, SERVER_SECRET, PARTNER1_WIF.
 *
 * Готовить состояние можно чем угодно (прямое действие в цепь, SQL стенда),
 * проверять — только тем, что видят хаб, провайдер и кооператив.
 */
import { execSync } from 'node:child_process'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIN_URL, SERVER_SECRET, amount, ensureShareFunds, gqlAs, loginAs, signAs } from './marketplace/chainHelpers'

const PROVIDER_URL = process.env.PROVIDER_URL || 'http://127.0.0.1:3005'
const COOP = 'partner1'
const OPERATOR = 'voskhod'
const PARTNER1_WIF = process.env.PARTNER1_WIF || '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'
const PARTNER1 = { email: process.env.PARTNER1_EMAIL || `chairman.${COOP}@example.com`, wif: PARTNER1_WIF, account: COOP }
/** Длина биллингового дня стенда, мс: месяц в 30 минут → день в минуту. */
const DAY_MS = Number(process.env.BILLING_PERIOD_MINUTES || 30) * 60_000 / 30
const AXON_PRICE_RUB = 10
const QUANT_AXON = 5
const QUANT_RUB = 50

// ── Провайдер (server-secret, как хаб) ──────────────────────────────────────
const PROVIDER_BEARER_TOKEN = process.env.PROVIDER_BEARER_TOKEN || ''

/** Каталог витрины провайдер отдаёт по Bearer-токену Восхода, остальное — по server-secret. */
async function provider<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = path.startsWith('/v1/')
    ? { Authorization: `Bearer ${PROVIDER_BEARER_TOKEN}` }
    : { 'server-secret': SERVER_SECRET }
  const res = await fetch(`${PROVIDER_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok)
    throw new Error(`provider ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : (undefined as T)
}

const subscriptionsOf = (coop: string) => provider<any[]>('GET', `/subscriptions/by-username/${coop}`)
const paymentsOf = (id: number) => provider<any[]>('GET', `/subscriptions/${id}/payments`)

// ── Цепь ────────────────────────────────────────────────────────────────────
async function axonBalance(account: string): Promise<number> {
  const res = await fetch(`${CHAIN_URL}/v1/chain/get_currency_balance`, {
    method: 'POST',
    body: JSON.stringify({ code: 'eosio.token', account, symbol: 'AXON' }),
  })
  const rows: string[] = await res.json()
  return rows.length ? amount(rows[0]) : 0
}

let chainInstance: any = null
async function chain(): Promise<any> {
  if (!chainInstance) {
    const [{ default: Blockchain }, { default: cfg }] = await Promise.all([import('../blockchain'), import('../configs')])
    chainInstance = new Blockchain((cfg as any).network, [...(cfg as any).private_keys, PARTNER1_WIF])
    await chainInstance.update_pass_instance()
  }
  return chainInstance
}

/** Узел кооператива жжёт бак сам: аренда ресурсов на сутки за свой AXON. */
async function rentResources(payer: string, axon: number): Promise<void> {
  const bc = await chain()
  await bc.powerup({ payer, receiver: payer, days: 1, payment: `${axon.toFixed(4)} AXON`, transfer: false })
}

// ── Ожидания ────────────────────────────────────────────────────────────────
async function waitFor<T>(label: string, timeoutMs: number, probe: () => Promise<T | null | undefined | false>): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe().catch(() => null)
    if (value)
      return value as T
    if (Date.now() > deadline)
      throw new Error(`не дождались: ${label} за ${Math.round(timeoutMs / 1000)} с`)
    // timing: backoff — опрос стенда, пока такт хаба или провайдера не сделает своё
    await new Promise(r => setTimeout(r, 5_000))
  }
}

/**
 * Подготовка: подписки partner1, заведённые провайдером до выбора тарифа (аренда
 * стартует при появлении кооператива в цепи, а выбор тарифа идёт из мастера
 * позже), убираем — иначе цены и пробный период были бы не тарифные.
 */
function dropUntariffedSubscriptions(coop: string): void {
  execSync(
    `docker exec postgres-provider psql -U provider -d provider -c "delete from subscriptions where instance_username='${coop}' and price_locked=false"`,
    { stdio: 'ignore' },
  )
}

describe('бак AXON: пробный период → объём месяца → квант сверх тарифа (стенд, сжатое время)', () => {
  let token: string
  let typeByCode: Record<string, number>
  let subs: any[]
  let trialEnd: Date
  let axonBefore: number

  beforeAll(async () => {
    token = await loginAs(PARTNER1)
    const types = await provider<any[]>('GET', '/subscriptions/types')
    typeByCode = Object.fromEntries(types.map(t => [t.code, t.id]))
    expect(typeByCode.hosting, 'тип hosting').toBeTruthy()
    expect(typeByCode.docflow, 'тип docflow').toBeTruthy()
  })

  it('выбор тарифа Стандарт → все строки пробные 9 дней, одна дата окончания, цены тарифа под замком', async () => {
    await provider('PUT', `/instances/${COOP}/tariff`, { tariff_code: 'standard', billing_period: 'month' })
    dropUntariffedSubscriptions(COOP)

    for (const code of ['hosting', 'support', 'app', 'docflow']) {
      await provider('POST', '/subscriptions/setup', {
        coopname: COOP,
        subscription_type_id: typeByCode[code],
        instance_username: COOP,
      })
    }
    subs = await subscriptionsOf(COOP)
    const byCode = Object.fromEntries(subs.map(s => [s.subscription_type_code, s]))
    expect(Object.keys(byCode).sort()).toEqual(['app', 'docflow', 'hosting', 'support'])
    for (const s of subs) {
      expect(s.status, `${s.subscription_type_code} пробная`).toBe('TRIAL')
      expect(s.is_trial).toBe(true)
      expect(s.price_locked, `${s.subscription_type_code} цена под замком`).toBe(true)
    }
    expect(Number(byCode.hosting.price)).toBe(6500)
    expect(Number(byCode.support.price)).toBe(2000)
    expect(Number(byCode.app.price)).toBe(4000)
    expect(Number(byCode.docflow.price)).toBe(4800)

    const ends = subs.map(s => new Date(s.expires_at).getTime())
    expect(Math.max(...ends) - Math.min(...ends), 'одна дата окончания у всех строк').toBeLessThan(2_000)
    trialEnd = new Date(Math.min(...ends))
    // Строки мог завести и провайдер при аренде до запуска теста — пробный
    // период меряем от старта самой ранней строки, а не от старта теста.
    const started = Math.min(...subs.map(s => new Date(s.started_at).getTime()))
    const trialDays = (trialEnd.getTime() - started) / DAY_MS
    expect(trialDays).toBeGreaterThan(8.9)
    expect(trialDays).toBeLessThan(9.2)
  })

  it('каталог провайдера: текущий тариф с объёмом, D на текущий месяц без округления и пробным периодом', async () => {
    const catalog = await provider<any>('GET', `/v1/subscription-types?coopname=${COOP}`)
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(catalog.current_tariff).toMatchObject({ code: 'standard', docflow_axon: 480, trial_days: 9 })
    expect(catalog.current_tariff.daily_axon).toBeCloseTo(480 / daysInMonth, 6)
  })

  it('кооператив пополняет биллинг-кошелёк заявлением — как в кабинете', async () => {
    await ensureShareFunds(COOP, 25_000)
    const gen: any = await gqlAs(
      token,
      'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash meta binary } }',
      { i: { data: { registry_id: 1095, coopname: OPERATOR, username: COOP, convert_amount: '25000 RUB' } } },
    )
    const document = await signAs(PARTNER1_WIF, gen.generateDocument, COOP, 1095)
    const res: any = await gqlAs(
      token,
      'mutation($i:BillingConvertInput!){ billingConvert(input:$i){ transactionId } }',
      { i: { coopname: OPERATOR, username: COOP, amount: '25000 RUB', document } },
    )
    expect(res.billingConvert.transactionId).toBeTruthy()
    axonBefore = await axonBalance(COOP)
  })

  it('конец пробного периода: календарные строки оплачены, документооборот — объёмом месяца в бак (+480 AXON), подписки продлены', async () => {
    const waitMs = Math.max(0, trialEnd.getTime() - Date.now()) + 4 * 60_000
    const paid = await waitFor('первая оплата всех строк', waitMs, async () => {
      const list = await subscriptionsOf(COOP)
      const allActive = list.length === 4 && list.every(s => s.status === 'ACTIVE' && s.is_trial === false)
      return allActive ? list : null
    })
    const byCode = Object.fromEntries(paid.map(s => [s.subscription_type_code, s]))

    // Якорь — день первой оплаты: срок каждой строки ушёл на месяц от конца пробного периода.
    for (const s of paid) {
      const extendedDays = (new Date(s.expires_at).getTime() - trialEnd.getTime()) / DAY_MS
      expect(extendedDays, `${s.subscription_type_code} продлена на месяц`).toBeGreaterThan(29)
      expect(extendedDays).toBeLessThan(31.5)
      expect(new Date(s.next_payment_due).getTime()).toBe(new Date(s.expires_at).getTime())
    }

    // Документооборот оплачен объёмом месяца: один платёж 4 800 ₽ на период 30 дней.
    // Подтверждение приходит дважды (хаб и парсер) — платёж при этом один.
    const docflowPayments = await paymentsOf(byCode.docflow.id)
    const monthly = docflowPayments.filter(p => Number(p.amount) === 4800)
    expect(monthly, 'платёж объёма месяца один').toHaveLength(1)
    expect(monthly[0].extended_days).toBe(30)

    // Календарные строки оплачены одной транзакцией по одному платежу на строку,
    // без повторного счёта на какую-либо из них.
    for (const code of ['hosting', 'support', 'app']) {
      const payments = await paymentsOf(byCode[code].id)
      expect(payments, `${code}: один платёж`).toHaveLength(1)
      expect(payments[0].extended_days).toBe(30)
    }

    const axonAfter = await waitFor('480 AXON в баке', 60_000, async () => {
      const b = await axonBalance(COOP)
      return b >= axonBefore + 480 - 0.5 ? b : null
    })
    expect(axonAfter - axonBefore).toBeGreaterThanOrEqual(480 - 0.5)
  })

  it('бак ниже кванта → хаб докупает квант 5 AXON за 50 ₽; полный бак квантов не вызывает', async () => {
    const before = await axonBalance(COOP)
    expect(before, 'в баке есть объём месяца').toBeGreaterThan(QUANT_AXON)
    // Узел жжёт бак арендой ресурсов на сутки; оставляем меньше кванта.
    await rentResources(COOP, Math.floor(before) - 2)
    const low = await axonBalance(COOP)
    expect(low).toBeLessThan(QUANT_AXON)

    const docflow = (await subscriptionsOf(COOP)).find(s => s.subscription_type_code === 'docflow')
    const quant = await waitFor('квант 50 ₽', 3 * 60_000, async () => {
      const payments = await paymentsOf(docflow.id)
      return payments.find(p => Number(p.amount) === QUANT_RUB) ?? null
    })
    expect(quant.extended_days, 'квант срок подписки не двигает').toBe(0)
    const refilled = await waitFor('бак пополнен квантом', 60_000, async () => {
      const b = await axonBalance(COOP)
      return b >= low + QUANT_AXON - 0.01 ? b : null
    })
    expect(refilled).toBeGreaterThanOrEqual(QUANT_AXON)

    // Счётчик докупок месяца считает только кванты, объём месяца в него не входит;
    // срок документооборота не изменился.
    const after = (await subscriptionsOf(COOP)).find(s => s.subscription_type_code === 'docflow')
    expect(Number(after.packages_current_period_amount)).toBeGreaterThanOrEqual(QUANT_RUB)
    expect(Number(after.packages_current_period_amount)).toBeLessThan(4800)
    expect(after.expires_at).toBe(docflow.expires_at)

    // Бак не ниже кванта — следующий такт квант не выписывает.
    const paymentsNow = (await paymentsOf(docflow.id)).length
    // timing: schedule — ждём два такта бака, чтобы увидеть отсутствие нового кванта
    await new Promise(r => setTimeout(r, 130_000))
    const paymentsLater = (await paymentsOf(docflow.id)).length
    expect(paymentsLater, 'при баке не ниже кванта новых квантов нет').toBe(paymentsNow)
  })

  it('квант стоит по курсу 10 ₽ за AXON: 5 AXON = 50 ₽', () => {
    expect(QUANT_AXON * AXON_PRICE_RUB).toBe(QUANT_RUB)
  })
})
