/**
 * Полный путь приложения каталога на связке двух кооперативов (487-34).
 *
 * Ведущий стенд — кооператив-оператор voskhod: цепь, провайдер подключения,
 * каталог приложений, хаб биллинга. Ведомый стенд — узел подключённого
 * кооператива partner1 на соседнем чекауте. Тест ведёт partner1 тем путём,
 * которым ходит председатель кооператива и автоматика (26.10.2026 — подписку
 * оформляет узел кооператива сам, оператор её только показывает):
 *
 *   1. витрина на узле partner1 показывает приложение с ценой провайдера, не
 *      подключённое; оператору оно видно среди предложений;
 *   2. председатель подписывается на узле partner1 — подписка становится
 *      строкой общего счёта у провайдера, провайдер передаёт её копию
 *      каталогу, оркестратор узла partner1 ставит приложение, витрина узла
 *      показывает подписку и установленный фронт; раздел «Подписки» узла
 *      показывает строку приложения;
 *   3. кооператив пополняет биллинг-кошелёк заявлением у оператора, наступает
 *      срок оплаты, хаб списывает строку приложения (billing::pay), провайдер
 *      продлевает подписку на месяц;
 *   4. председатель выключает приложение на узле — фронт не отдаётся столу,
 *      подписка идёт; включает снова — фронт отдаётся;
 *   5. председатель отписывается на узле — подписка отменена, каталог
 *      закрывает доступ, оркестратор узла partner1 снимает приложение.
 *
 * Готовить состояние можно чем угодно (SQL стенда — чтобы не ждать месяц до
 * срока оплаты), проверять — только тем, что видят кооператив, провайдер и
 * узел partner1.
 *
 * Требования: `pnpm run reboot:extra2coop:master` в чекауте ведущего, затем
 * `pnpm run reboot:extra2coop:slave` в чекауте ведомого; цена пакета в
 * каталоге. Запуск — `pnpm run test:two-coop` в чекауте ведущего.
 * Переменные: API_URL (GraphQL ведущего), SLAVE_API_URL (GraphQL узла partner1),
 * PROVIDER_URL, SLAVE_ORCHESTRATOR_URL, CATALOG_PACKAGE, PARTNER1_WIF.
 */
import { execSync } from 'node:child_process'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import ecc from 'eosjs-ecc'
import { beforeAll, describe, expect, it } from 'vitest'
import { partner1Keys } from '../init/partner1-key'
import { CHAIN_URL, ensureShareFunds, gqlAs, loginAs, signAs } from './marketplace/chainHelpers'
import { paymentsOf, provider, subscriptionsOf, waitFor } from './shared/stand'

const COOP = 'partner1'
const OPERATOR = 'voskhod'
const PACKAGE = process.env.CATALOG_PACKAGE || '@voskhod/demoapp'
const SLAVE_API_URL = process.env.SLAVE_API_URL || 'http://127.0.0.1:3998/v1/graphql'
const SLAVE_ORCHESTRATOR_URL = process.env.SLAVE_ORCHESTRATOR_URL || 'http://127.0.0.1:4000'
const PARTNER1_EMAIL = process.env.PARTNER1_EMAIL || `chairman.${COOP}@example.com`
// Ключ partner1 — тот, которым boot завёл аккаунт в цепи ведущего; им же
// входит председатель на узле partner1 (стандартный ключ dev-сети).
let PARTNER1_WIF = ''
/** Длина биллингового дня стенда, мс: месяц в 30 минут → день в минуту. */
const DAY_MS = Number(process.env.BILLING_PERIOD_MINUTES || 30) * 60_000 / 30

const APP_FIELDS = 'package_id title price period_days trial_days subscription { status amount_per_period started_at expires_at is_trial }'
const CATALOG_FIELDS = 'packageId title rubPerMonth trialDays installed enabled subscription { status isTrial trialEndsAt expiresAt nextPaymentDue amountPerPeriod }'

/** GraphQL узла partner1 от лица его председателя. */
async function gqlOnSlave<T = any>(token: string | null, query: string, variables?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token)
    headers.Authorization = `Bearer ${token}`
  const res = await fetch(SLAVE_API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const text = await res.text()
  let payload: any
  try {
    payload = JSON.parse(text)
  }
  catch {
    throw new Error(`gql узла partner1 не-JSON (status=${res.status}): ${text.slice(0, 200)}`)
  }
  if (payload.errors)
    throw new Error(`gql узла partner1: ${payload.errors[0]?.message ?? JSON.stringify(payload.errors).slice(0, 300)}`)
  return payload.data as T
}

/** Вход председателя на узле partner1 — подпись head_block_time, как в SDK. */
async function loginOnSlave(): Promise<string> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time
  const signature = ecc.signHash(ecc.sha256(Buffer.from(now, 'utf8'), 'hex'), PARTNER1_WIF)
  const d: any = await gqlOnSlave(
    null,
    'mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }',
    { d: { email: PARTNER1_EMAIL, now, signature } },
  )
  return d.login.tokens.access.token
}

/** Строка витрины узла partner1 по пакету. */
async function catalogRow(token: string): Promise<any | null> {
  const res: any = await gqlOnSlave(token, `{ appsCatalogRemotePackages(page:1, pageSize:50) { ${CATALOG_FIELDS} } }`)
  return res.appsCatalogRemotePackages.find((a: any) => a.packageId === PACKAGE) ?? null
}

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

describe('приложение каталога на связке двух кооперативов: подписка на узле → оплата у оператора → выключение → отмена', () => {
  let hubToken: string
  let nodeToken: string

  beforeAll(async () => {
    PARTNER1_WIF = (await partner1Keys()).privateKey
    hubToken = await loginAs({ email: PARTNER1_EMAIL, wif: PARTNER1_WIF, account: COOP })
    nodeToken = await loginOnSlave()
    // Прогон повторяем: подписку прошлого прогона снимаем с узла.
    if (await appSubscription())
      await gqlOnSlave(nodeToken, 'mutation($d:SubscribePackageInputDTO!){ unsubscribePackage(data:$d){ status } }', { d: { packageId: PACKAGE } })
    await gqlOnSlave(nodeToken, 'mutation($d:SetCatalogAppEnabledInput!){ setCatalogAppEnabled(data:$d) }', { d: { packageId: PACKAGE, enabled: true } })
  })

  it('витрина узла partner1 показывает приложение с ценой провайдера, не подключённое; оператору оно видно среди предложений', async () => {
    const row = await catalogRow(nodeToken)
    expect(row, `${PACKAGE} на витрине узла partner1`).toBeTruthy()
    expect(row.rubPerMonth).toBeGreaterThan(0)
    expect(row.subscription).toBeNull()
    expect(row.enabled).toBe(true)

    const res: any = await gqlAs(hubToken, `{ getProviderApps { ${APP_FIELDS} } }`)
    const app = res.getProviderApps.find((a: any) => a.package_id === PACKAGE)
    expect(app, `${PACKAGE} среди предложений провайдера у оператора`).toBeTruthy()
    expect(Number(app.price)).toBe(row.rubPerMonth)
    expect(app.subscription).toBeNull()
  })

  it('подписка на узле: строка общего счёта, копия в каталоге, узел partner1 ставит приложение, раздел «Подписки» показывает строку', async () => {
    const res: any = await gqlOnSlave(
      nodeToken,
      'mutation($d:SubscribePackageInputDTO!){ subscribePackage(data:$d){ status state packageId endAt error } }',
      { d: { packageId: PACKAGE } },
    )
    expect(res.subscribePackage.status, res.subscribePackage.error ?? '').toBe('activated')
    expect(res.subscribePackage.packageId).toBe(PACKAGE)

    const summary = await provider<any>('GET', `/subscriptions/billing-summary/${COOP}`)
    const line = summary.items.find((i: any) => i.subscription_type_name === PACKAGE)
    expect(line, 'строка приложения в общем счёте').toBeTruthy()

    await waitFor('приложение на узле partner1', 3 * 60_000, async () =>
      (await installedOnSlave()).includes(PACKAGE))

    const row = await catalogRow(nodeToken)
    expect(row.subscription?.status).toBe('ACTIVE')
    expect(row.installed).toBe(true)
    expect(row.enabled).toBe(true)

    const billing: any = await gqlOnSlave(nodeToken, '{ appsNodeBilling { available operator subscriptions { packageId status price } monthlyTotal } }')
    expect(billing.appsNodeBilling.available).toBe(true)
    expect(billing.appsNodeBilling.operator).toBe(OPERATOR)
    const nodeLine = billing.appsNodeBilling.subscriptions.find((s: any) => s.packageId === PACKAGE)
    expect(nodeLine, 'строка приложения в подписках узла').toBeTruthy()
    expect(Number(nodeLine.price)).toBe(row.rubPerMonth)
  })

  it('оплата: хаб списывает строку приложения с биллинг-кошелька у оператора, подписка продлена на месяц', async () => {
    const sub = await appSubscription()
    expect(sub, 'подписка приложения у провайдера').toBeTruthy()

    // Пополнение — заявлением у оператора, как в кабинете.
    const amountRub = Math.ceil(Number(sub.price)) + 100
    await ensureShareFunds(COOP, amountRub)
    const gen: any = await gqlAs(
      hubToken,
      'mutation($i:GenerateAnyDocumentInput!){ generateDocument(input:$i){ full_title html hash meta binary } }',
      { i: { data: { registry_id: 1095, coopname: OPERATOR, username: COOP, convert_amount: `${amountRub} RUB` } } },
    )
    const document = await signAs(PARTNER1_WIF, gen.generateDocument, COOP, 1095)
    await gqlAs(
      hubToken,
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

    // Продление идёт от момента оплаты, когда прежний срок остался в прошлом;
    // здесь срок наступил только что — новый срок около месяца стенда вперёд.
    const after = await appSubscription()
    const extendedDays = (new Date(after.expires_at).getTime() - new Date(due).getTime()) / DAY_MS
    expect(extendedDays, 'срок продлён на месяц стенда').toBeGreaterThan(27)
  })

  it('выключение на узле: фронт столу не отдаётся, подписка идёт; включение возвращает фронт', async () => {
    await gqlOnSlave(nodeToken, 'mutation($d:SetCatalogAppEnabledInput!){ setCatalogAppEnabled(data:$d) }', { d: { packageId: PACKAGE, enabled: false } })
    let row = await catalogRow(nodeToken)
    expect(row.enabled).toBe(false)
    expect(row.subscription?.status).toBe('ACTIVE')
    expect(await appSubscription(), 'подписка у провайдера не тронута').toBeTruthy()
    // Оркестратор фронт держит: снимает его только отмена подписки.
    expect(await installedOnSlave()).toContain(PACKAGE)

    await gqlOnSlave(nodeToken, 'mutation($d:SetCatalogAppEnabledInput!){ setCatalogAppEnabled(data:$d) }', { d: { packageId: PACKAGE, enabled: true } })
    row = await catalogRow(nodeToken)
    expect(row.enabled).toBe(true)
  })

  it('отмена на узле: подписка отменена, узел partner1 снимает приложение', async () => {
    const res: any = await gqlOnSlave(
      nodeToken,
      'mutation($d:SubscribePackageInputDTO!){ unsubscribePackage(data:$d){ status packageId error } }',
      { d: { packageId: PACKAGE } },
    )
    expect(res.unsubscribePackage.status, res.unsubscribePackage.error ?? '').toBe('cancelled')
    expect(await appSubscription()).toBeNull()
    expect((await catalogRow(nodeToken)).subscription).toBeNull()

    await waitFor('приложение снято с узла partner1', 3 * 60_000, async () =>
      !(await installedOnSlave()).includes(PACKAGE))
  })
})
