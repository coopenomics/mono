/**
 * Полный путь приложения каталога на связке двух кооперативов (487-34).
 *
 * Ведущий стенд — кооператив-оператор voskhod: цепь, провайдер подключения,
 * каталог приложений, хаб биллинга. Ведомый стенд — узел подключённого
 * кооператива partner1 на соседнем чекауте. Тест ведёт partner1 тем путём,
 * которым ходит председатель кооператива и автоматика:
 *
 *   1. стол подключения у оператора предлагает приложение с ценой каталога;
 *   2. кооператив подключает приложение — подписка становится строкой его
 *      общего счёта у провайдера, провайдер передаёт её копию каталогу, и
 *      оркестратор узла partner1 ставит приложение;
 *   3. кооператив пополняет биллинг-кошелёк заявлением, наступает срок оплаты,
 *      хаб списывает строку приложения (billing::pay), провайдер продлевает
 *      подписку на месяц;
 *   4. кооператив отключает приложение — подписка отменена, каталог закрывает
 *      доступ, оркестратор узла partner1 снимает приложение.
 *
 * Готовить состояние можно чем угодно (SQL стенда — чтобы не ждать месяц до
 * срока оплаты), проверять — только тем, что видят кооператив, провайдер и
 * узел partner1.
 *
 * Требования: `pnpm run reboot:extra2coop:master` в чекауте ведущего, затем
 * `pnpm run reboot:extra2coop:slave` в чекауте ведомого; цена пакета в
 * каталоге. Запуск — `pnpm run test:two-coop` в чекауте ведущего.
 * Переменные: API_URL (GraphQL ведущего), PROVIDER_URL, SLAVE_ORCHESTRATOR_URL,
 * CATALOG_PACKAGE, PARTNER1_WIF.
 */
import { execSync } from 'node:child_process'
import process from 'node:process'
import { beforeAll, describe, expect, it } from 'vitest'
import { partner1Keys } from '../init/partner1-key'
import { ensureShareFunds, gqlAs, loginAs, signAs } from './marketplace/chainHelpers'
import { paymentsOf, provider, subscriptionsOf, waitFor } from './shared/stand'

const COOP = 'partner1'
const OPERATOR = 'voskhod'
const PACKAGE = process.env.CATALOG_PACKAGE || '@voskhod/demoapp'
const SLAVE_ORCHESTRATOR_URL = process.env.SLAVE_ORCHESTRATOR_URL || 'http://127.0.0.1:4000'
const PARTNER1_EMAIL = process.env.PARTNER1_EMAIL || `chairman.${COOP}@example.com`
// Ключ partner1 — тот, которым boot завёл аккаунт в цепи ведущего.
let PARTNER1_WIF = ''
/** Длина биллингового дня стенда, мс: месяц в 30 минут → день в минуту. */
const DAY_MS = Number(process.env.BILLING_PERIOD_MINUTES || 30) * 60_000 / 30

const APP_FIELDS = 'package_id title price period_days subscription { status amount_per_period started_at expires_at }'

/** Фронт-части, которые оркестратор узла partner1 реально поставил. */
async function installedOnSlave(): Promise<string[]> {
  const res = await fetch(`${SLAVE_ORCHESTRATOR_URL}/v1/internal/extensions/frontend`)
  if (!res.ok)
    throw new Error(`оркестратор partner1 → ${res.status}`)
  const body = (await res.json()) as { items: Array<{ packageId: string }> }
  return body.items.map(i => i.packageId)
}

/** Подписка приложения у провайдера: та, что не отменена. */
async function appSubscription(): Promise<any | null> {
  const subs = await subscriptionsOf(COOP)
  return subs.find(s => s.subscription_type_name === PACKAGE && s.status !== 'CANCELLED') ?? null
}

describe('приложение каталога на связке двух кооперативов: подключение → оплата → отключение', () => {
  let token: string

  beforeAll(async () => {
    PARTNER1_WIF = (await partner1Keys()).privateKey
    token = await loginAs({ email: PARTNER1_EMAIL, wif: PARTNER1_WIF, account: COOP })
    // Прогон повторяем: подключённое прошлым прогоном приложение отключаем.
    const apps: any = await gqlAs(token, `{ getProviderApps { ${APP_FIELDS} } }`)
    const left = apps.getProviderApps.find((a: any) => a.package_id === PACKAGE)
    if (left?.subscription)
      await gqlAs(token, `mutation($d:ProviderAppInput!){ cancelProviderApp(data:$d){ package_id } }`, { d: { package_id: PACKAGE } })
  })

  it('стол подключения предлагает приложение с ценой каталога; оно не подключено', async () => {
    const res: any = await gqlAs(token, `{ getProviderApps { ${APP_FIELDS} } }`)
    const app = res.getProviderApps.find((a: any) => a.package_id === PACKAGE)
    expect(app, `${PACKAGE} среди предложений провайдера`).toBeTruthy()
    expect(Number(app.price)).toBeGreaterThan(0)
    expect(app.period_days).toBe(30)
    expect(app.subscription).toBeNull()
  })

  it('подключение: строка общего счёта, копия в каталоге, узел partner1 ставит приложение', async () => {
    const res: any = await gqlAs(
      token,
      `mutation($d:ProviderAppInput!){ subscribeProviderApp(data:$d){ ${APP_FIELDS} } }`,
      { d: { package_id: PACKAGE } },
    )
    expect(res.subscribeProviderApp.subscription.status).toBe('ACTIVE')

    const summary = await provider<any>('GET', `/subscriptions/billing-summary/${COOP}`)
    const line = summary.items.find((i: any) => i.subscription_type_name === PACKAGE)
    expect(line, 'строка приложения в общем счёте').toBeTruthy()
    expect(Number(line.amount)).toBe(Number(res.subscribeProviderApp.price))

    await waitFor('приложение на узле partner1', 3 * 60_000, async () =>
      (await installedOnSlave()).includes(PACKAGE))
  })

  it('оплата: хаб списывает строку приложения с биллинг-кошелька, подписка продлена на месяц', async () => {
    const sub = await appSubscription()
    expect(sub, 'подписка приложения у провайдера').toBeTruthy()

    // Пополнение — заявлением, как в кабинете.
    const amountRub = Math.ceil(Number(sub.price)) + 100
    await ensureShareFunds(COOP, amountRub)
    const gen: any = await gqlAs(
      token,
      'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash meta binary } }',
      { i: { data: { registry_id: 1095, coopname: OPERATOR, username: COOP, convert_amount: `${amountRub} RUB` } } },
    )
    const document = await signAs(PARTNER1_WIF, gen.generateDocument, COOP, 1095)
    await gqlAs(
      token,
      'mutation($i:BillingConvertInput!){ billingConvert(input:$i){ transactionId } }',
      { i: { coopname: OPERATOR, username: COOP, amount: `${amountRub} RUB`, document } },
    )

    // Хаб платит счёт целиком: чужая наступившая строка (например, хостинг,
    // которого у узла вне провайдера быть не должно) съела бы пополнение.
    const bill = await provider<any>('GET', `/subscriptions/billing-summary/${COOP}`)
    const otherDue = bill.items.filter((i: any) => i.is_due && i.subscription_type_name !== PACKAGE)
    expect(otherDue, 'в счёте partner1 нет других наступивших строк').toEqual([])

    // Срок оплаты — сейчас: ждать месяц стенда незачем. Остальные строки счёта
    // кооператива срок не меняют — хаб платит только наступившее.
    const due = new Date(Date.now() + 20_000).toISOString()
    execSync(
      `docker exec postgres-provider psql -U provider -d provider -c "update subscriptions set expires_at='${due}', next_payment_due='${due}' where id=${Number(sub.id)}"`,
      { stdio: 'ignore' },
    )

    const paid = await waitFor('оплата строки приложения хабом', 5 * 60_000, async () => {
      const payments = await paymentsOf(sub.id)
      return payments.length ? payments : null
    })
    expect(paid, 'один платёж').toHaveLength(1)
    expect(Number(paid[0].amount)).toBe(Number(sub.price))
    expect(paid[0].extended_days).toBe(30)

    const after = await appSubscription()
    const extendedDays = (new Date(after.expires_at).getTime() - new Date(due).getTime()) / DAY_MS
    expect(extendedDays, 'срок продлён на месяц стенда').toBeGreaterThan(28)
  })

  it('отключение: подписка отменена, узел partner1 снимает приложение', async () => {
    const res: any = await gqlAs(
      token,
      `mutation($d:ProviderAppInput!){ cancelProviderApp(data:$d){ ${APP_FIELDS} } }`,
      { d: { package_id: PACKAGE } },
    )
    expect(res.cancelProviderApp.subscription).toBeNull()
    expect(await appSubscription()).toBeNull()

    await waitFor('приложение снято с узла partner1', 3 * 60_000, async () =>
      !(await installedOnSlave()).includes(PACKAGE))
  })
})
