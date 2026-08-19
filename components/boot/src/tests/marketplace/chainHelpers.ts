/**
 * Общие хелперы контрактных тестов Стола заказов (задача 598-51).
 *
 * Тесты гоняют ЖИВУЮ цепь стенда через backend GraphQL — тот же путь, которым
 * ходит desktop, — и ассертят проводки ledger2. Проводки читаются не по
 * «счётчик вырос», а по нитке процесса: `getLedger2History` умеет фильтр
 * `processHash`, поэтому по хэшу заказа (или заявки на возврат) поднимается
 * ровно та нитка, которую породила проверяемая цепочка действий, и в ней
 * ассертятся коды операций, суммы и бухсчета.
 *
 * Имени нитки (`process_type`) в DTO истории нет — оно лежит в сырых данных
 * действия `ledger2::apply`, поэтому берётся из реестра процессов
 * (`process(hash, coopname){ actions{ name data } }`). Это единственный способ
 * отличить нитку поставки от нитки экономики участка (ledger2.process-naming
 * l2.pnam.side.01/02).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import ecc from 'eosjs-ecc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Фикстуры участников сюиты docs-harness — единственный источник WIF'ов стенда. */
export const STATE_DIR = path.resolve(__dirname, '../../../../docs-harness/state/participants')

export const API_URL
  = process.env.CONTROLLER_GRAPHQL_URL || process.env.API_URL || 'http://127.0.0.1:2998/v1/graphql'
export const CHAIN_URL = process.env.CHAIN_URL || 'http://127.0.0.1:8888'
export const SERVER_SECRET = process.env.SERVER_SECRET || 'SECRET'
export const COOP = 'voskhod'

/** Бухсчёта в истории отдаются умноженными на 1000 (`accountId`). */
export const ACC = { MATERIALS: 10_000, SHARE: 80_000, TARGET: 86_000, OTHER: 91_000, CASH: 51_000 }

export interface Who { email: string, wif: string, account: string }

export function fromState(name: string): Who {
  const p = path.join(STATE_DIR, `${name}.json`)
  if (!fs.existsSync(p)) {
    throw new Error(
      `нет фикстуры ${p} — контрактные тесты Стола заказов гоняются только на стенде с сидом docs-harness`,
    )
  }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  return { email: j.email, wif: j.wif, account: j.username }
}

/**
 * Запрос от лица пайщика. Заголовок `server-secret` НЕ шлётся сознательно:
 * `MarketplaceMembershipGuard` считает его межсервисным обходом, выходит из
 * гварда рано и не кладёт `currentMember` в контекст — после чего любой
 * резолвер Стола заказов падает с «currentMember отсутствует в context».
 * Тест ходит тем же путём, что и desktop: только Bearer-токен.
 */
export async function gqlAs<T = any>(token: string | null, query: string, variables?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const text = await res.text()
  let payload: any
  try {
    payload = JSON.parse(text)
  }
  catch {
    throw new Error(`gql не-JSON (status=${res.status}): ${text.slice(0, 200)}`)
  }
  if (payload.errors) throw new Error(`gql: ${payload.errors[0]?.message ?? JSON.stringify(payload.errors).slice(0, 300)}`)
  return payload.data as T
}

/** Логин по WIF фикстуры — подпись head_block_time, как это делает SDK Client.login. */
export async function loginAs(who: Who): Promise<string> {
  const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
  const now = info.head_block_time
  const signature = ecc.signHash(ecc.sha256(Buffer.from(now, 'utf8'), 'hex'), who.wif)
  const d: any = await gqlAs(
    null,
    'mutation($d:LoginInput!){ login(data:$d){ tokens{ access{ token } } account{ username } } }',
    { d: { email: who.email, now, signature } },
  )
  return d.login.tokens.access.token
}

/** Председатель кооператива стенда (ant) — те же реквизиты, что у shared/apiClient. */
export const CHAIRMAN: Who = {
  email: process.env.TEST_EMAIL || 'ivanov@example.com',
  wif: process.env.TEST_WIF || '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
  account: 'ant',
}

export interface LedgerRow {
  action: string
  operationCode: string | null
  processHash: string | null
  username: string | null
  accountId: number | null
  walletFrom: string | null
  walletTo: string | null
  quantity: string | null
  memo: string | null
}

const HISTORY_QUERY = `query($i:GetLedger2HistoryInput!){
  getLedger2History(input:$i){
    totalCount
    items { action operationCode processHash username accountId walletFrom walletTo quantity memo }
  }
}`

/**
 * Все строки ledger2 одной нитки. Хэш из цепи приходит в UPPERCASE, а в БД
 * лежит в lowercase — резолвер lower-aware, но вызывающий код может держать
 * любой регистр, поэтому нормализуем сами.
 */
export async function historyOfProcess(token: string, processHash: string): Promise<LedgerRow[]> {
  // Пустой/битый хэш `getLedger2History` молча игнорирует и отдаёт ВЕСЬ журнал
  // кооператива — ассерты на такой выборке проходили бы по чужим проводкам.
  // Ловим это здесь, чтобы падало на причине, а не на следствии.
  if (!/^[0-9a-f]{64}$/i.test(processHash ?? '')) {
    throw new Error(`historyOfProcess: ожидался hex-64 хэш нитки, получено "${processHash}"`)
  }
  const d: any = await gqlAs(token, HISTORY_QUERY, {
    i: { coopname: COOP, processHash: processHash.toLowerCase(), limit: 200, page: 1 },
  })
  return d.getLedger2History.items as LedgerRow[]
}

/** Только проводки (`apply`) нитки — по ним ассертятся коды операций и суммы. */
export async function applyOpsOfProcess(token: string, processHash: string): Promise<LedgerRow[]> {
  return (await historyOfProcess(token, processHash)).filter(r => r.action === 'apply')
}

/** «100.0000 RUB» → 100. */
export function amount(q: unknown): number {
  return Number.parseFloat(String(q ?? '0').split(' ')[0])
}

/** Сумма всех проводок нитки с данным кодом операции (проводок кода может быть несколько). */
export function sumOf(rows: LedgerRow[], code: string): number {
  return rows.filter(r => r.operationCode === code).reduce((s, r) => s + amount(r.quantity), 0)
}

export function opsCodes(rows: LedgerRow[]): string[] {
  return rows.map(r => r.operationCode).filter(Boolean) as string[]
}

const PROCESS_QUERY = `query($h:String!,$c:String!){ process(hash:$h, coopname:$c){ process_type actions{ name data } } }`

/**
 * Имя нитки, с которым КАЖДАЯ проводка ушла на цепь: `operation_code` →
 * `process_type` из сырых данных `ledger2::apply`. Именно это, а не
 * агрегированный `process_type` реестра, отвечает на вопрос
 * ledger2.process-naming — под чьим именем идёт инлайн-зачисление.
 */
export async function processTypeByOperation(token: string, processHash: string): Promise<Record<string, string>> {
  const d: any = await gqlAs(token, PROCESS_QUERY, { h: processHash.toLowerCase(), c: COOP })
  const out: Record<string, string> = {}
  for (const a of (d.process?.actions ?? [])) {
    if (a.name !== 'apply') continue
    const data = typeof a.data === 'string' ? JSON.parse(a.data) : a.data
    if (data?.operation_code) out[data.operation_code] = data.process_type
  }
  return out
}

/**
 * Проводки доходят до журнала контроллера через parser2 — пара блоков лага
 * штатны. Ждём появления ожидаемых кодов, а не спим фиксированно.
 */
export async function waitForOps(
  token: string,
  processHash: string,
  expectedCodes: string[],
  timeoutMs = 180_000,
): Promise<LedgerRow[]> {
  const deadline = Date.now() + timeoutMs
  let last: LedgerRow[] = []
  while (Date.now() < deadline) {
    last = await applyOpsOfProcess(token, processHash)
    const have = new Set(opsCodes(last))
    if (expectedCodes.every(c => have.has(c))) return last
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error(
    `нитка ${processHash}: за ${timeoutMs} мс не дождались проводок [${expectedCodes.join(', ')}]; `
    + `пришли [${opsCodes(last).join(', ') || '—'}]`,
  )
}

/**
 * Дождаться, пока зеркало заказа в бэкенде сойдётся с цепью.
 *
 * Строка заказа создаётся оптимистично сразу на оформлении, а суммы (тело и
 * членский взнос) доезжают дельтой parser2 через пару блоков. Читать заказ
 * сразу после оформления нельзя — вернётся взнос 0, и тест ассертил бы
 * недосинхронизированное состояние вместо реального.
 */
export async function waitForOrderMirror(
  token: string,
  orderId: string,
  ready: (order: any) => boolean,
  timeoutMs = 180_000,
): Promise<any> {
  const query = `query($i:MarketplaceGetOrderInput!){
    marketplaceGetOrder(input:$i){ id status order_hash quantity total_cost total_cost_with_fee membership_fee price_per_unit }
  }`
  const deadline = Date.now() + timeoutMs
  let last: any = null
  while (Date.now() < deadline) {
    const d: any = await gqlAs(token, query, { i: { order_id: orderId } })
    last = d.marketplaceGetOrder
    if (ready(last)) return last
    await new Promise(r => setTimeout(r, 1500))
  }
  throw new Error(`зеркало заказа ${orderId} не сошлось с цепью за ${timeoutMs} мс: ${JSON.stringify(last)}`)
}

/** Подписант документов SDK — вынесен, чтобы тесты не тянули Classes напрямую. */
export async function signAs(wif: string, doc: unknown, account: string, id: number, aggregates?: unknown[]) {
  const { Classes } = await import('@coopenomics/sdk')
  const signer = new Classes.Document(wif)
  return aggregates
    ? await (signer as any).signDocument(doc, account, id, aggregates)
    : await (signer as any).signDocument(doc, account, id)
}

// ── Обеспечение фикстуры средствами ─────────────────────────────────────────
// Каждый прогон списывает с паевого кошелька заказчицы тело заказа и членский
// взнос. Сид docs-harness даёт конечный остаток, поэтому без дозаправки тесты
// повторяемы лишь несколько раз, а потом падают на «Недостаточно средств для
// оформления» — и выглядит это как регресс продукта, хотя это исчерпание
// фикстуры. Дозаправляем сами: тест обязан быть повторяемым неограниченно.

let chainInstance: any = null

async function chain(): Promise<any> {
  if (!chainInstance) {
    const [{ default: Blockchain }, { default: cfg }] = await Promise.all([
      import('../../blockchain'),
      import('../../configs'),
    ])
    chainInstance = new Blockchain((cfg as any).network, (cfg as any).private_keys)
    await chainInstance.update_pass_instance()
  }
  return chainInstance
}

/** Доступный остаток главного паевого кошелька пайщика (из ledger2 L3). */
export async function availableShare(username: string): Promise<number> {
  const res = await fetch(`${CHAIN_URL}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: true, code: 'ledger2', scope: COOP, table: 'userwallets', limit: 1000 }),
  })
  const d: any = await res.json()
  const row = (d.rows ?? []).find((r: any) => r.username === username && r.wallet_name === 'w.wal.share')
  return amount(row?.available)
}

/**
 * Довести паевой остаток пайщика до нужного минимума. Возвращает итоговый
 * остаток. Если средств хватает — ничего не делает.
 */
export async function ensureShareFunds(username: string, minimumRub: number): Promise<number> {
  const have = await availableShare(username)
  if (have >= minimumRub) return have
  const { depositToWallet } = await import('../wallet/depositToWallet')
  await depositToWallet(await chain(), COOP, username, Math.ceil(minimumRub - have) + 10_000)
  return availableShare(username)
}
