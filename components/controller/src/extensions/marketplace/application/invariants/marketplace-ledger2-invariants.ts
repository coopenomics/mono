/**
 * Off-chain агрегаторы инвариантов ledger2 для marketplace-операций (Story 11.3).
 *
 * Считают семь инвариантов учёта по срезу истории учёта (порт
 * `LEDGER2_HISTORY_PORT`) + текущим балансам кошельков и счетов + открытым
 * расчётам с поставщиками из проекции заказов. Та же логика что в UI стола
 * бухгалтера: никаких сумм по всем кошелькам пайщиков в смарт-контракте —
 * всё считается серверной агрегацией.
 *
 * Принципиальная off-chain работа: модуль ничего не знает про PG/NestJS,
 * принимает на вход уже агрегированные ledger2-строки. Это позволяет:
 *   1. Гонять unit-тестами на синтетических последовательностях операций
 *      без реального chain'а (Story 11.3 CI guard на каждом PR в marketplace
 *      или ledger2).
 *   2. Использовать тот же код в работе: `MarketplaceLedgerInvariantsService`
 *      прогоняет его по часам и по запросу председателя (задача 99D-14).
 *
 * Живёт в расширении, а не в ядре: инвариант по счёту 76 сверяет проводки с
 * заказами, а заказы ядру недоступны.
 *
 * Все суммы — `bigint` в minor units (4 знака после запятой для RUB),
 * чтобы избежать ошибок float-арифметики при агрегации длинной истории.
 */

import { Ledger2 } from 'cooptypes'

/** Asset цепи «100.0000 RUB» либо чистая сумма проекции «100.0000» — символ необязателен. */
const ASSET_RE = /^(-?\d+)(?:\.(\d+))?(?:\s+[A-Z]{1,7})?$/

/** «100.0000 RUB» → 1000000 (bigint в minor units precision=4). */
export function parseAssetToBigInt(quantity: string | null | undefined, precision = 4): bigint {
  if (!quantity) return 0n
  const m = ASSET_RE.exec(quantity.trim())
  if (!m) throw new Error(`parseAssetToBigInt: не распознан asset "${quantity}"`)
  const [, intPart, fracPart = ''] = m
  const padded = (fracPart + '0'.repeat(precision)).slice(0, precision)
  const sign = intPart.startsWith('-') ? -1n : 1n
  const absInt = intPart.startsWith('-') ? intPart.slice(1) : intPart
  return sign * (BigInt(absInt) * 10n ** BigInt(precision) + BigInt(padded || '0'))
}

export function formatBigIntAsset(amount: bigint, precision = 4, symbol = 'RUB'): string {
  const base = 10n ** BigInt(precision)
  const sign = amount < 0n ? '-' : ''
  const abs = amount < 0n ? -amount : amount
  const intPart = abs / base
  const fracPart = abs % base
  const fracStr = fracPart.toString().padStart(precision, '0')
  return `${sign}${intPart}.${fracStr} ${symbol}`
}

/**
 * Срез ledger2-операции в форме, минимально нужной инвариантам. Соответствует
 * подмножеству `Ledger2OperationDTO` (`ledger2-operation.dto.ts`).
 */
export interface MarketplaceLedger2OperationRow {
  globalSequence: string
  action: 'apply' | 'walletop' | 'debit' | 'credit'
  operationCode?: string | null
  processHash?: string | null
  walletFrom?: string | null
  walletTo?: string | null
  accountId?: number | null
  quantity?: string | null
  /**
   * global_sequence родительского apply у строк walletop/debit/credit: по ней
   * проводка привязывается к своей операции точно, а не по нитке процесса.
   * В синтетике тестов может отсутствовать — тогда код берётся из самой
   * строки либо из набора операций нитки.
   */
  parentApplyGlobalSequence?: string | null
}

/** Текущий баланс кошелька (`getLedger2Wallets` row). */
export interface MarketplaceWalletRow {
  wallet: string // 'w.mkt.order' / 'w.mkt.debt' / ...
  balance: string // asset «100.0000 RUB»
  blocked?: string | null
}

/** Текущий баланс бух.счёта (`getLedger2Accounts` row). */
export interface MarketplaceAccountRow {
  accountId: number // 10 / 86 / 91 / 51 / 80
  balance: string
}

/**
 * Незавершённый расчёт с поставщиком по заказу: имущество принято, выплата
 * ещё не подтверждена кассиром. Источник — проекция заказов; `processHash` =
 * хэш заказа. Принятая стоимость берётся из истории (o.mkt.purch этой нитки);
 * `acceptedCost` из проекции — запасной вариант, когда нитки в истории нет.
 */
export interface MarketplaceOpenSettlementRow {
  processHash: string
  /** Принятая стоимость по акту приёмки — asset «100.0000 RUB»; null у заказов, принятых до появления поля. */
  acceptedCost?: string | null
}

export interface InvariantResult {
  ok: boolean
  invariant: string
  expected?: string
  actual?: string
  violation?: string
  details?: Array<{ processHash: string; message: string }>
}

const MARKETPLACE_OP_CODES = Object.freeze(
  new Set(
    Ledger2.LEDGER2_OPERATION_REGISTRY.filter((op) => op.contract === 'marketplace').map((op) => op.code),
  ),
)

function isMarketplaceCode(code: string | null | undefined): boolean {
  return !!code && MARKETPLACE_OP_CODES.has(code)
}

// ---------------------------------------------------------------------------
// Индекс операций: коды по ниткам, код по global_sequence apply, итоги по
// кодам внутри нитки. Строится один раз на прогон и переиспользуется всеми
// инвариантами.
// ---------------------------------------------------------------------------
interface CodeTotal {
  count: number
  total: bigint
}

interface OperationIndex {
  /** Коды apply в нитке процесса. */
  codesByProcess: Map<string, string[]>
  /** Код операции по global_sequence её apply. */
  codeByApplySeq: Map<string, string>
  /** Итоги apply по кодам внутри нитки: сколько раз и на какую сумму. */
  totalsByProcess: Map<string, Map<string, CodeTotal>>
}

function indexOperations(rows: readonly MarketplaceLedger2OperationRow[]): OperationIndex {
  const codesByProcess = new Map<string, string[]>()
  const codeByApplySeq = new Map<string, string>()
  const totalsByProcess = new Map<string, Map<string, CodeTotal>>()
  for (const r of rows) {
    if (r.action !== 'apply' || !r.processHash || !r.operationCode) continue
    codeByApplySeq.set(r.globalSequence, r.operationCode)
    const codes = codesByProcess.get(r.processHash) ?? []
    codes.push(r.operationCode)
    codesByProcess.set(r.processHash, codes)
    const totals = totalsByProcess.get(r.processHash) ?? new Map<string, CodeTotal>()
    const t = totals.get(r.operationCode) ?? { count: 0, total: 0n }
    t.count += 1
    t.total += parseAssetToBigInt(r.quantity)
    totals.set(r.operationCode, t)
    totalsByProcess.set(r.processHash, totals)
  }
  return { codesByProcess, codeByApplySeq, totalsByProcess }
}

function isMarketplaceThread(processHash: string | null | undefined, index: OperationIndex): boolean {
  if (!processHash) return false
  return (index.codesByProcess.get(processHash) ?? []).some(isMarketplaceCode)
}

/** Код операции проводки: из строки, по родительскому apply, иначе неизвестен. */
function postingCode(row: MarketplaceLedger2OperationRow, index: OperationIndex): string | null {
  if (row.operationCode) return row.operationCode
  if (row.parentApplyGlobalSequence) return index.codeByApplySeq.get(row.parentApplyGlobalSequence) ?? null
  return null
}

/** Строки debit/credit по счёту `accountId` в нитках marketplace. */
function marketplacePostingsOnAccount(
  rows: readonly MarketplaceLedger2OperationRow[],
  index: OperationIndex,
  accountId: number,
): MarketplaceLedger2OperationRow[] {
  return rows.filter(
    (r) =>
      (r.action === 'debit' || r.action === 'credit') &&
      r.accountId === accountId &&
      isMarketplaceThread(r.processHash, index),
  )
}

/** Сальдо счёта по marketplace-проводкам: для активного счёта дебет минус кредит, для пассивного наоборот. */
function marketplaceAccountBalance(
  rows: readonly MarketplaceLedger2OperationRow[],
  index: OperationIndex,
  accountId: number,
  kind: 'active' | 'passive',
): bigint {
  let balance = 0n
  for (const r of marketplacePostingsOnAccount(rows, index, accountId)) {
    const amount = parseAssetToBigInt(r.quantity)
    const isDebit = r.action === 'debit'
    balance += (kind === 'active') === isDebit ? amount : -amount
  }
  return balance
}

// ---------------------------------------------------------------------------
// Проверка использования счёта: на каждой стороне допустимы только
// перечисленные операции. Общая для I2 (счёт 86) и I4 (счёт 91).
// ---------------------------------------------------------------------------
interface AccountSideRule {
  codes: readonly string[]
  missing: string
}

function checkAccountUsage(params: {
  invariant: string
  accountId: number
  rules: Record<'debit' | 'credit', AccountSideRule>
  rows: readonly MarketplaceLedger2OperationRow[]
  expected: string
  violation: string
}): InvariantResult {
  const { invariant, accountId, rules, rows } = params
  const index = indexOperations(rows)
  const violations: Array<{ processHash: string; message: string }> = []
  const totals = { debit: 0n, credit: 0n }
  for (const r of marketplacePostingsOnAccount(rows, index, accountId)) {
    const side = r.action as 'debit' | 'credit'
    totals[side] += parseAssetToBigInt(r.quantity)
    const rule = rules[side]
    const code = postingCode(r, index)
    const threadCodes = index.codesByProcess.get(r.processHash as string) ?? []
    const allowed = code ? rule.codes.includes(code) : threadCodes.some((c) => rule.codes.includes(c))
    if (!allowed) {
      violations.push({
        processHash: r.processHash as string,
        message: `${side === 'debit' ? 'дебет' : 'кредит'} ${accountId} на ${r.quantity ?? '∅'} ${rule.missing} в нитке: ${threadCodes.join(', ')}`,
      })
    }
  }
  const summary = `dr=${formatBigIntAsset(totals.debit)} / cr=${formatBigIntAsset(totals.credit)}`
  if (violations.length > 0) {
    return { ok: false, invariant, expected: params.expected, actual: summary, violation: params.violation, details: violations }
  }
  return { ok: true, invariant, expected: summary }
}

// ---------------------------------------------------------------------------
// I1 — Расчёт с поставщиком закрывается по каждому заказу ровно принятой
// суммой (задача 99D-15).
//
// В нитке заказа приёмка (o.mkt.purch, Кт 76) бывает один раз, выплата
// (o.mkt.payout, Дт 76) — не больше одного раза, и сумма выплаты вместе с
// удержанным долгом (o.mkt.deduct) равна принятой стоимости. Выплата без
// приёмки, вторая приёмка или выплата, удержание сверх принятого — нарушения.
// Прежняя редакция сверяла кошелёк выплат с его же историей и не могла
// показать ничего, кроме сбоя самого ledger2.
// ---------------------------------------------------------------------------
/** Нарушения формы нитки: вторая приёмка, выплата без приёмки, вторая выплата. */
function supplierThreadShapeIssues(purch: CodeTotal | undefined, payout: CodeTotal | undefined): string[] {
  const out: string[] = []
  if (purch && purch.count > 1) out.push(`приёмка проведена ${purch.count} раза на ${formatBigIntAsset(purch.total)}`)
  if (payout && !purch) out.push(`выплата ${formatBigIntAsset(payout.total)} без приёмки в нитке`)
  if (payout && payout.count > 1) out.push(`выплата проведена ${payout.count} раза на ${formatBigIntAsset(payout.total)}`)
  return out
}

/** Сходится ли расчёт нитки по суммам: выплата плюс удержание против принятой стоимости. */
function supplierThreadSettlement(
  purch: CodeTotal,
  payout: CodeTotal | undefined,
  deductTotal: bigint,
): { issue: string | null; closed: boolean } {
  const settled = (payout?.total ?? 0n) + deductTotal
  if (payout) {
    const issue =
      settled === purch.total
        ? null
        : `выплата ${formatBigIntAsset(payout.total)} и удержание ${formatBigIntAsset(deductTotal)} не закрывают принятую стоимость ${formatBigIntAsset(purch.total)}`
    return { issue, closed: true }
  }
  if (settled > purch.total) {
    return { issue: `удержано ${formatBigIntAsset(settled)} — больше принятой стоимости ${formatBigIntAsset(purch.total)}`, closed: false }
  }
  return { issue: null, closed: settled === purch.total }
}

type SupplierThreadState = 'skip' | 'open' | 'closed'

/** Разбор одной нитки: нарушения уходят в `report`, возвращается состояние расчёта. */
function inspectSupplierThread(totals: Map<string, CodeTotal>, report: (message: string) => void): SupplierThreadState {
  const purch = totals.get('o.mkt.purch')
  const payout = totals.get('o.mkt.payout')
  const deduct = totals.get('o.mkt.deduct')
  if (!purch && !payout && !deduct) return 'skip'
  supplierThreadShapeIssues(purch, payout).forEach(report)
  if (!purch) return 'open'
  const { issue, closed } = supplierThreadSettlement(purch, payout, deduct?.total ?? 0n)
  if (issue) report(issue)
  return closed ? 'closed' : 'open'
}

export function checkInvariantI1SupplierThreads(rows: readonly MarketplaceLedger2OperationRow[]): InvariantResult {
  const index = indexOperations(rows)
  const violations: Array<{ processHash: string; message: string }> = []
  const counts = { open: 0, closed: 0 }
  for (const [processHash, totals] of index.totalsByProcess) {
    const state = inspectSupplierThread(totals, (message) => violations.push({ processHash, message }))
    if (state !== 'skip') counts[state] += 1
  }
  const summary = `ниток: ${counts.open + counts.closed}, закрытых: ${counts.closed}`
  if (violations.length > 0) {
    return {
      ok: false,
      invariant: 'I1',
      expected: 'по каждому заказу выплата и удержание закрывают принятую стоимость',
      actual: summary,
      violation: 'I1: расчёт с поставщиком по заказу закрыт не на принятую сумму либо проведён дважды.',
      details: violations,
    }
  }
  return { ok: true, invariant: 'I1', expected: summary }
}

// ---------------------------------------------------------------------------
// I2 — Счёт 86 в marketplace: только перевод в членский, удержание при
// отказе и списание скоропорта.
//
// В паевой модели тело заказа живёт на счёте 80; на 86 Стол заказов пишет
// ровно три операции: o.mkt.conv (Кт 86, перевод паевого в членский по
// заявлению 1110), o.mkt.penal (Кт 86, удержание при отказе) и o.mkt.wroff
// (Дт 86, списание скоропорта). Любая другая проводка по 86 в нитке Стола
// заказов — чужая либо сбой реестра. Прежняя редакция считала дельту и
// всегда отвечала «сходится».
// ---------------------------------------------------------------------------
const ACCOUNT_86_SIDES: Record<'debit' | 'credit', AccountSideRule> = {
  debit: { codes: ['o.mkt.wroff'], missing: 'без списания скоропорта (o.mkt.wroff)' },
  credit: { codes: ['o.mkt.conv', 'o.mkt.penal'], missing: 'без перевода в членский (o.mkt.conv) и удержания при отказе (o.mkt.penal)' },
}

export function checkInvariantI2Account86Usage(rows: readonly MarketplaceLedger2OperationRow[]): InvariantResult {
  return checkAccountUsage({
    invariant: 'I2',
    accountId: 86,
    rules: ACCOUNT_86_SIDES,
    rows,
    expected: 'дебет 86 только списанием скоропорта, кредит 86 только переводом в членский и удержанием при отказе',
    violation: 'I2: на счёте 86 есть marketplace-проводки вне перевода в членский, удержания при отказе и списания скоропорта.',
  })
}

// ---------------------------------------------------------------------------
// I3 — Баланс счёта 10 (МАТЕРИАЛЫ, активный):
//   balance(10) = Σ debit(10) − Σ credit(10)
//
// По marketplace-операциям:
//   +o.mkt.purch  (Dr 10)   — приём имущества (Дт 10 / Кт 76)
//   −o.mkt.consum (Cr 10)   — выдача (Дт 80 / Кт 10)
//   −o.mkt.wroff  (Cr 10)   — списание скоропорта
//   −o.mkt.loss   (Cr 10)   — уценка остатка
//   +o.mkt.return (Dr 10)   — гарантийный возврат (Дт 10 / Кт 80)
//
// Сверяем delta по 10 с показанием `getLedger2Accounts.balance(10)`.
// Если на входе нет accounts[10] — return ok с computed=delta (для
// инкрементальных тестов без полной БД).
// ---------------------------------------------------------------------------
export function checkInvariantI3Account10Materials(
  rows: readonly MarketplaceLedger2OperationRow[],
  accounts: readonly MarketplaceAccountRow[],
): InvariantResult {
  const index = indexOperations(rows)
  const computed = marketplaceAccountBalance(rows, index, 10, 'active')
  const acc10 = accounts.find((a) => a.accountId === 10)
  if (!acc10) {
    // На свежем кооперативе или в синтетических тестах account 10 может
    // отсутствовать — инвариант считает «всё ок, посчитан только delta».
    return { ok: true, invariant: 'I3', expected: formatBigIntAsset(computed) }
  }
  const actual = parseAssetToBigInt(acc10.balance)
  if (computed !== actual) {
    return {
      ok: false,
      invariant: 'I3',
      expected: formatBigIntAsset(computed),
      actual: formatBigIntAsset(actual),
      violation:
        'I3: баланс счёта 10 не совпадает с marketplace-вкладом (purch+return2 − consum−wroff). ' +
        'Возможный источник: пропущенный consum/wroff или дублирующий purch.',
    }
  }
  return { ok: true, invariant: 'I3', expected: formatBigIntAsset(computed) }
}

// ---------------------------------------------------------------------------
// I4 — Счёт 91 в marketplace: только уценка и признанные претензии.
//
// 91 «Прочие доходы и расходы» в marketplace пишут ровно две операции:
//   o.mkt.loss  (Дт 91 / Кт 10) — уценка остатка при выдаче (markdown);
//   o.mkt.admit (Дт 76 / Кт 91) — поставщик признал гарантийную претензию.
// Любая другая строка по 91 в нитке marketplace — чужая проводка либо сбой
// реестра.
// ---------------------------------------------------------------------------
const ACCOUNT_91_SIDES: Record<'debit' | 'credit', AccountSideRule> = {
  debit: { codes: ['o.mkt.loss'], missing: 'без уценки (o.mkt.loss)' },
  credit: { codes: ['o.mkt.admit'], missing: 'без признанной претензии (o.mkt.admit)' },
}

export function checkInvariantI4Account91Usage(rows: readonly MarketplaceLedger2OperationRow[]): InvariantResult {
  return checkAccountUsage({
    invariant: 'I4',
    accountId: 91,
    rules: ACCOUNT_91_SIDES,
    rows,
    expected: 'дебет 91 только уценкой, кредит 91 только признанной претензией',
    violation: 'I4: на счёте 91 есть marketplace-проводки вне уценки и признанных претензий.',
  })
}

// ---------------------------------------------------------------------------
// I5 — Согласованность паевого резерва под Order на кошельке w.mkt.order:
//   sum(TRANSFER w.wal.share → w.mkt.order)         // o.mkt.lock   — паевой резерв из Кошелька (без проводки)
//   + sum(TRANSFER w.mkt.share → w.mkt.order)       // o.mkt.lockp  — резерв из свободного паевого «Стола заказов»
//   − sum(TRANSFER w.mkt.order → w.mkt.share)       // o.mkt.unlock — резерв снят / недовыдача / отказ
//   − sum(TRANSFER w.mkt.order → w.mkt.fee)         // o.mkt.penal  — штраф за отказ (Дт 80 / Кт 86)
//   − sum(BURN w.mkt.order)                         // o.mkt.consum — резерв сожжён при выдаче (Дт 80 / Кт 10)
//     = sum(available у w.mkt.order-кошельков пайщиков).
//
// Паевая модель (компонент 68, 2026-09-06): паевой взнос под заказ идёт с
// главного паевого (w.wal.share) либо со свободного паевого «Стола заказов»
// (w.mkt.share) на резерв-кошелёк w.mkt.order при createorder; возврат при
// отмене/недовыдаче/отказе поступает на свободный паевой w.mkt.share.
//
// На входе тестов wallets обычно содержит aggregated available по всем
// w.mkt.order-row. Можно подать одну строку с агрегированным `balance`.
// ---------------------------------------------------------------------------
/**
 * Знак движения по резерву w.mkt.order для пары кошельков walletop:
 *   +1 — резерв входит (o.mkt.lock с w.wal.share, o.mkt.lockp с w.mkt.share);
 *   −1 — резерв выходит (o.mkt.unlock на w.mkt.share, o.mkt.penal на w.mkt.fee,
 *        o.mkt.consum — BURN без получателя);
 *    0 — движение резерва не касается.
 */
function reserveDeltaSign(walletFrom: string | null | undefined, walletTo: string | null | undefined): -1n | 0n | 1n {
  if (walletTo === 'w.mkt.order' && (walletFrom === 'w.wal.share' || walletFrom === 'w.mkt.share')) return 1n
  if (walletFrom !== 'w.mkt.order') return 0n
  if (walletTo === 'w.mkt.share' || walletTo === 'w.mkt.fee' || walletTo == null) return -1n
  return 0n
}

export function checkInvariantI5ReserveConsistency(
  rows: readonly MarketplaceLedger2OperationRow[],
  wallets: readonly MarketplaceWalletRow[],
): InvariantResult {
  let computed = 0n
  for (const r of rows) {
    if (r.action !== 'walletop') continue
    computed += reserveDeltaSign(r.walletFrom, r.walletTo) * parseAssetToBigInt(r.quantity)
  }
  const orderWallets = wallets.filter((w) => w.wallet === 'w.mkt.order')
  let totalReserve = 0n
  for (const w of orderWallets) {
    totalReserve += parseAssetToBigInt(w.balance)
  }
  if (computed !== totalReserve) {
    return {
      ok: false,
      invariant: 'I5',
      expected: formatBigIntAsset(computed),
      actual: formatBigIntAsset(totalReserve),
      violation:
        'I5: резерв на w.mkt.order не совпадает с историей lock − unlock − consum. ' +
        'Возможный источник: пропущенный unlock при отмене Order или повторный lock без unlock.',
    }
  }
  return { ok: true, invariant: 'I5', expected: formatBigIntAsset(computed) }
}

// ---------------------------------------------------------------------------
// I6 — Парность операций в жизненном цикле Order'а: каждому резерву по
// process_hash должно соответствовать либо o.mkt.unlock (отмена Order), либо
// o.mkt.consum (выдача), либо открытый Order (process ещё активен — здесь
// не проверяем).
//
// Резерв вносится любым из двух кодов: o.mkt.lock (с паевого Цифрового
// кошелька) или o.mkt.lockp (со свободного паевого «Стола заказов»); заказ,
// оплаченный целиком из свободного паевого, содержит только lockp (задача
// 99D-15: прежняя редакция знала один lock и считала такую выдачу выдачей без
// резерва).
//
// Одна process_hash (= order_hash) может содержать lock + unlock (отмена),
// lock + consum (выдача) или только lock (активный Order, не нарушение).
//
// Для статической проверки в CI рассматриваем закрытые процессы: если в
// процессе есть o.mkt.unlock без резерва, или есть o.mkt.consum без
// резерва — нарушение. Если есть все три (резерв + unlock + consum) —
// тоже нарушение (двойное закрытие резерва).
// ---------------------------------------------------------------------------
const RESERVE_CODES = ['o.mkt.lock', 'o.mkt.lockp'] as const

export function checkInvariantI6NoOrphanedReserves(
  rows: readonly MarketplaceLedger2OperationRow[],
): InvariantResult {
  const index = indexOperations(rows)
  const violations: Array<{ processHash: string; message: string }> = []

  for (const [processHash, codes] of index.codesByProcess) {
    const hasLock = RESERVE_CODES.some((c) => codes.includes(c))
    const hasUnlock = codes.includes('o.mkt.unlock')
    const hasConsum = codes.includes('o.mkt.consum')

    if (hasConsum && !hasLock) {
      violations.push({
        processHash,
        message:
          'consum без предшествующего резерва (lock / lockp) — невозможно списать резерв, которого не было.',
      })
    }
    if (hasUnlock && !hasLock) {
      violations.push({
        processHash,
        message: 'unlock без резерва (lock / lockp) — невозможно снять резерв, который не вносился.',
      })
    }
    if (hasLock && hasUnlock && hasConsum) {
      violations.push({
        processHash,
        message: 'резерв + unlock + consum в одном процессе — двойное закрытие резерва.',
      })
    }
  }
  if (violations.length > 0) {
    return {
      ok: false,
      invariant: 'I6',
      violation: 'I6: обнаружены процессы с некорректной парностью резерва/unlock/consum.',
      details: violations,
    }
  }
  return { ok: true, invariant: 'I6' }
}

// ---------------------------------------------------------------------------
// I7 — Долг поставщикам на счёте 76 равен открытым расчётам (задача 99D-14).
//
// 76 «Расчёты с разными дебиторами и кредиторами» в marketplace двигают:
//   o.mkt.purch  (Кт 76) — приёмка: долг поставщику на принятую стоимость;
//   o.mkt.payout (Дт 76) — выплата подтверждена кассиром;
//   o.mkt.admit  (Дт 76) — поставщик признал претензию: его долг сворачивается
//                          с нашим (гасится удержанием без проводки, o.mkt.deduct).
// Значит остаток кредита 76 по marketplace-строкам обязан равняться сумме
// принятой стоимости заказов, по которым выплата ещё не подтверждена, минус
// уже удержанное по ним и минус признанный, но ещё не удержанный долг
// поставщиков (остаток w.mkt.debt).
//
// Принятая стоимость открытого заказа берётся из его нитки в истории
// (o.mkt.purch): так сходятся и заказы, принятые до появления поля
// `accepted_cost` в проекции (задача 99D-15); из проекции нужен только
// список открытых расчётов. Удержание при инициации (o.mkt.deduct в нитке)
// и уже проведённая выплата (если проекция отстаёт от цепи) вычитаются.
//
// Именно этот инвариант ловит оба дефекта задачи 99D-14: проводку выплаты
// не на ту сумму (остаток 76 ≠ 0 при закрытых расчётах) и стёртый заказ с
// открытой выплатой (76 держит долг, а заказа, который его закроет, больше нет).
// ---------------------------------------------------------------------------
export function checkInvariantI7SupplierSettlements(
  rows: readonly MarketplaceLedger2OperationRow[],
  wallets: readonly MarketplaceWalletRow[],
  settlements: readonly MarketplaceOpenSettlementRow[],
): InvariantResult {
  const index = indexOperations(rows)
  const ledger76 = marketplaceAccountBalance(rows, index, 76, 'passive')

  let openOutstanding = 0n
  const details: Array<{ processHash: string; message: string }> = []
  for (const s of settlements) {
    const totals = index.totalsByProcess.get(s.processHash)
    const purch = totals?.get('o.mkt.purch')?.total
    const accepted = purch ?? parseAssetToBigInt(s.acceptedCost)
    const settled = (totals?.get('o.mkt.deduct')?.total ?? 0n) + (totals?.get('o.mkt.payout')?.total ?? 0n)
    const outstanding = accepted - settled
    openOutstanding += outstanding
    details.push({ processHash: s.processHash, message: `открытый расчёт на ${formatBigIntAsset(outstanding)}` })
  }
  let admittedDebt = 0n
  for (const w of wallets) {
    if (w.wallet === 'w.mkt.debt') admittedDebt += parseAssetToBigInt(w.balance)
  }
  const expected = openOutstanding - admittedDebt

  if (ledger76 !== expected) {
    return {
      ok: false,
      invariant: 'I7',
      expected: formatBigIntAsset(expected),
      actual: formatBigIntAsset(ledger76),
      violation:
        'I7: остаток счёта 76 по Столу заказов не равен открытым расчётам с поставщиками ' +
        '(принятая стоимость заказов с неподтверждённой выплатой за вычетом удержанного минус признанный долг поставщиков). ' +
        'Возможный источник: выплата проведена не на принятую сумму либо заказ стёрт при незавершённой выплате.',
      details,
    }
  }
  return { ok: true, invariant: 'I7', expected: formatBigIntAsset(expected) }
}

/**
 * Пакетная проверка всех 7 инвариантов. Возвращает массив результатов
 * в порядке I1..I7. Никогда не throw — все проблемы как `violation` в результате.
 */
export function checkAllMarketplaceLedger2Invariants(
  rows: readonly MarketplaceLedger2OperationRow[],
  wallets: readonly MarketplaceWalletRow[],
  accounts: readonly MarketplaceAccountRow[],
  settlements: readonly MarketplaceOpenSettlementRow[] = [],
): InvariantResult[] {
  return [
    checkInvariantI1SupplierThreads(rows),
    checkInvariantI2Account86Usage(rows),
    checkInvariantI3Account10Materials(rows, accounts),
    checkInvariantI4Account91Usage(rows),
    checkInvariantI5ReserveConsistency(rows, wallets),
    checkInvariantI6NoOrphanedReserves(rows),
    checkInvariantI7SupplierSettlements(rows, wallets, settlements),
  ]
}

/** Internal: для интеграции с другими тестами / админ-вью. */
export const MARKETPLACE_OPERATION_CODES = MARKETPLACE_OP_CODES
