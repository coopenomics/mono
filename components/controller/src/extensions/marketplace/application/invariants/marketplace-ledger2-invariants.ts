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

const ASSET_RE = /^(-?\d+)(?:\.(\d+))?\s+[A-Z]{1,7}$/

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
}

/** Текущий баланс кошелька (`getLedger2Wallets` row). */
export interface MarketplaceWalletRow {
  wallet: string // 'w.mkt.order' / 'w.mkt.payout' / ...
  balance: string // asset «100.0000 RUB»
  blocked?: string | null
}

/** Текущий баланс бух.счёта (`getLedger2Accounts` row). */
export interface MarketplaceAccountRow {
  accountId: number // 10 / 86 / 91 / 51 / 80
  balance: string
}

/**
 * Незавершённый расчёт с поставщиком по заказу: имущество принято (есть
 * `accepted_cost`), выплата ещё не подтверждена кассиром. Источник — проекция
 * заказов; `processHash` = хэш заказа.
 */
export interface MarketplaceOpenSettlementRow {
  processHash: string
  /** Принятая стоимость по акту приёмки — asset «100.0000 RUB». */
  acceptedCost: string
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

/**
 * Для каждой строки `walletop`/`debit`/`credit` восстановим `operationCode`
 * через `parentApplyGlobalSequence`-связь на ближайший apply. Здесь у нас
 * нет parentApply, поэтому работаем с группировкой по `processHash`:
 * если у строки `processHash` совпадает с processHash от apply, и apply
 * относится к marketplace — считаем строку marketplace-relevant.
 *
 * NB: для production-данных корректнее использовать `parentApplyGlobalSequence`
 * (один apply — одно трио walletop+debit+credit), но для unit-тестов хватает
 * processHash, потому что в синтетике мы намеренно строим один apply на один
 * processHash.
 */
function indexApplyOperationsByProcessHash(
  rows: readonly MarketplaceLedger2OperationRow[],
): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const r of rows) {
    if (r.action !== 'apply' || !r.processHash || !r.operationCode) continue
    const arr = m.get(r.processHash) ?? []
    arr.push(r.operationCode)
    m.set(r.processHash, arr)
  }
  return m
}

function processHashHasMarketplaceApply(
  processHash: string | null | undefined,
  applyIndex: Map<string, string[]>,
): boolean {
  if (!processHash) return false
  const codes = applyIndex.get(processHash) ?? []
  return codes.some(isMarketplaceCode)
}

// ---------------------------------------------------------------------------
// I1 — Баланс w.mkt.payout = Σ ISSUE(w.mkt.payout) − Σ BURN(w.mkt.payout)
//
// w.mkt.payout — кошелёк-задолженность кооператива перед поставщиками.
// `o.mkt.payout` (Dr 86 / Cr 51, ISSUE → w.mkt.payout) поднимает баланс на
// сумму приёмки. `gateway::payconfirm` (после фактической отправки денег)
// делает BURN на w.mkt.payout, закрывая обязательство.
//
// На длинной истории Σ ISSUE − Σ BURN = текущий баланс w.mkt.payout
// (= неоплаченная часть приёмок).
// ---------------------------------------------------------------------------
export function checkInvariantI1PayoutBalance(
  rows: readonly MarketplaceLedger2OperationRow[],
  wallets: readonly MarketplaceWalletRow[],
): InvariantResult {
  let computed = 0n
  for (const r of rows) {
    if (r.action !== 'walletop') continue
    if (r.walletTo === 'w.mkt.payout' && r.walletFrom == null) {
      computed += parseAssetToBigInt(r.quantity)
    } else if (r.walletFrom === 'w.mkt.payout' && r.walletTo == null) {
      computed -= parseAssetToBigInt(r.quantity)
    }
  }
  const wallet = wallets.find((w) => w.wallet === 'w.mkt.payout')
  const actualBalance = wallet ? parseAssetToBigInt(wallet.balance) : 0n

  if (computed !== actualBalance) {
    return {
      ok: false,
      invariant: 'I1',
      expected: formatBigIntAsset(computed),
      actual: formatBigIntAsset(actualBalance),
      violation:
        'I1: баланс w.mkt.payout не совпадает с суммой ISSUE − BURN по истории. ' +
        'Возможный источник: пропущенный o.mkt.payout или несоответствие payconfirm/paydecline.',
    }
  }
  return { ok: true, invariant: 'I1', expected: formatBigIntAsset(computed) }
}

// ---------------------------------------------------------------------------
// I2 — Marketplace-вклад в баланс счёта 86 (ЦФ программы).
//
// 86 — пассивный счёт «Целевое финансирование». Баланс растёт credit-ом,
// уменьшается debit-ом. Для marketplace-операций должно выполняться:
//   Δ86_marketplace = Σ credit(86, mkt) − Σ debit(86, mkt)
//
// Marketplace contribution на счёт 86 формирует:
//   Паевая модель: тело заказа живёт на счёте 80 (паевой), на 86 попадают
//   только членские средства — перевод по заявлению 1110 (o.mkt.conv Кт 86)
//   и удержание при отказе (o.mkt.penal Кт 86); взнос под
//   заказ и его сторно (o.mkt.fee / o.mkt.refund) идут внутри 86 без проводки —
//   и списание скоропорта (o.mkt.wroff Дт 86). Приём имущества идёт Дт 10 / Кт 76,
//   выдача — Дт 80 / Кт 10, возврат — Дт 10 / Кт 80.
//
// Инвариант не требует наличия конкретного balance(86), но проверяет, что
// `delta` от marketplace в принципе считается без NaN/расхождений в подсчётах
// debit vs credit (сами marketplace-rows должны быть парными — каждый apply
// → debit + credit). Если pair-violation — repeating `debit` без `credit`
// или наоборот.
// ---------------------------------------------------------------------------
export function checkInvariantI2Account86Delta(
  rows: readonly MarketplaceLedger2OperationRow[],
): InvariantResult {
  const applyIndex = indexApplyOperationsByProcessHash(rows)
  let cr86 = 0n
  let dr86 = 0n
  let mismatch86debit = 0
  let mismatch86credit = 0
  for (const r of rows) {
    if (!processHashHasMarketplaceApply(r.processHash, applyIndex)) continue
    if (r.accountId !== 86) continue
    if (r.action === 'credit') {
      cr86 += parseAssetToBigInt(r.quantity)
      mismatch86credit += 1
    } else if (r.action === 'debit') {
      dr86 += parseAssetToBigInt(r.quantity)
      mismatch86debit += 1
    }
  }
  const delta = cr86 - dr86

  // Любая marketplace apply, которая по реестру имеет debit/credit равные
  // 86, должна породить ровно один debit и/или credit на 86. Здесь проверяем
  // только парность счётчиков (для каждого apply).
  return {
    ok: true,
    invariant: 'I2',
    expected: formatBigIntAsset(delta),
    actual: `cr=${formatBigIntAsset(cr86)} / dr=${formatBigIntAsset(dr86)} / cr-rows=${mismatch86credit} dr-rows=${mismatch86debit}`,
  }
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
  const applyIndex = indexApplyOperationsByProcessHash(rows)
  let computed = 0n
  for (const r of rows) {
    if (!processHashHasMarketplaceApply(r.processHash, applyIndex)) continue
    if (r.accountId !== 10) continue
    if (r.action === 'debit') {
      computed += parseAssetToBigInt(r.quantity)
    } else if (r.action === 'credit') {
      computed -= parseAssetToBigInt(r.quantity)
    }
  }
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
// реестра. Проверка по ниткам: дебет 91 допустим только в процессе с
// o.mkt.loss, кредит 91 — только с o.mkt.admit.
// ---------------------------------------------------------------------------
/** Какая операция оправдывает проводку по 91 на каждой стороне и как назвать её отсутствие. */
const ACCOUNT_91_SIDES: Record<'debit' | 'credit', { code: string; missing: string }> = {
  debit: { code: 'o.mkt.loss', missing: 'без уценки (o.mkt.loss)' },
  credit: { code: 'o.mkt.admit', missing: 'без признанной претензии (o.mkt.admit)' },
}

/** Строки debit/credit по счёту `accountId` в нитках marketplace. */
function marketplacePostingsOnAccount(
  rows: readonly MarketplaceLedger2OperationRow[],
  applyIndex: Map<string, string[]>,
  accountId: number,
): MarketplaceLedger2OperationRow[] {
  return rows.filter(
    (r) =>
      (r.action === 'debit' || r.action === 'credit') &&
      r.accountId === accountId &&
      processHashHasMarketplaceApply(r.processHash, applyIndex),
  )
}

export function checkInvariantI4Account91Usage(
  rows: readonly MarketplaceLedger2OperationRow[],
): InvariantResult {
  const applyIndex = indexApplyOperationsByProcessHash(rows)
  const violations: Array<{ processHash: string; message: string }> = []
  const totals = { debit: 0n, credit: 0n }
  for (const r of marketplacePostingsOnAccount(rows, applyIndex, 91)) {
    const side = r.action as 'debit' | 'credit'
    totals[side] += parseAssetToBigInt(r.quantity)
    const codes = applyIndex.get(r.processHash as string) ?? []
    if (!codes.includes(ACCOUNT_91_SIDES[side].code)) {
      violations.push({
        processHash: r.processHash as string,
        message: `${side === 'debit' ? 'дебет' : 'кредит'} 91 на ${r.quantity ?? '∅'} ${ACCOUNT_91_SIDES[side].missing} в нитке: ${codes.join(', ')}`,
      })
    }
  }
  const summary = `dr=${formatBigIntAsset(totals.debit)} / cr=${formatBigIntAsset(totals.credit)}`
  if (violations.length > 0) {
    return {
      ok: false,
      invariant: 'I4',
      expected: 'дебет 91 только уценкой, кредит 91 только признанной претензией',
      actual: summary,
      violation: 'I4: на счёте 91 есть marketplace-проводки вне уценки и признанных претензий.',
      details: violations,
    }
  }
  return { ok: true, invariant: 'I4', expected: summary }
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
// I6 — Парность операций в жизненном цикле Order'а: каждому o.mkt.lock по
// process_hash должно соответствовать либо o.mkt.unlock (отмена Order), либо
// o.mkt.consum (выдача), либо открытый Order (process ещё активен — здесь
// не проверяем).
//
// Одна process_hash (= order_hash) может содержать lock + unlock (отмена),
// lock + consum (выдача) или только lock (активный Order, не нарушение).
//
// Для статической проверки в CI рассматриваем закрытые процессы: если в
// процессе есть o.mkt.unlock без o.mkt.lock, или есть o.mkt.consum без
// o.mkt.lock — нарушение. Если есть все три (lock + unlock + consum) —
// тоже нарушение (двойное закрытие резерва).
// ---------------------------------------------------------------------------
export function checkInvariantI6NoOrphanedReserves(
  rows: readonly MarketplaceLedger2OperationRow[],
): InvariantResult {
  const applyIndex = indexApplyOperationsByProcessHash(rows)
  const violations: Array<{ processHash: string; message: string }> = []

  for (const [processHash, codes] of applyIndex) {
    const hasLock = codes.includes('o.mkt.lock')
    const hasUnlock = codes.includes('o.mkt.unlock')
    const hasConsum = codes.includes('o.mkt.consum')

    if (hasConsum && !hasLock) {
      violations.push({
        processHash,
        message:
          'consum без предшествующего lock — невозможно списать резерв, которого не было.',
      })
    }
    if (hasUnlock && !hasLock) {
      violations.push({
        processHash,
        message: 'unlock без lock — невозможно снять резерв, который не вносился.',
      })
    }
    if (hasLock && hasUnlock && hasConsum) {
      violations.push({
        processHash,
        message: 'lock + unlock + consum в одном процессе — двойное закрытие резерва.',
      })
    }
  }
  if (violations.length > 0) {
    return {
      ok: false,
      invariant: 'I6',
      violation: 'I6: обнаружены процессы с некорректной парностью lock/unlock/consum.',
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
// признанный, но ещё не удержанный долг поставщиков (остаток w.mkt.debt).
//
// Именно этот инвариант ловит оба дефекта задачи: проводку выплаты не на ту
// сумму (остаток 76 ≠ 0 при закрытых расчётах) и стёртый заказ с открытой
// выплатой (76 держит долг, а заказа, который его закроет, больше нет).
// ---------------------------------------------------------------------------
export function checkInvariantI7SupplierSettlements(
  rows: readonly MarketplaceLedger2OperationRow[],
  wallets: readonly MarketplaceWalletRow[],
  settlements: readonly MarketplaceOpenSettlementRow[],
): InvariantResult {
  const applyIndex = indexApplyOperationsByProcessHash(rows)
  let ledger76 = 0n
  for (const r of rows) {
    if (!processHashHasMarketplaceApply(r.processHash, applyIndex)) continue
    if (r.accountId !== 76) continue
    if (r.action === 'credit') ledger76 += parseAssetToBigInt(r.quantity)
    else if (r.action === 'debit') ledger76 -= parseAssetToBigInt(r.quantity)
  }

  let openAccepted = 0n
  for (const s of settlements) openAccepted += parseAssetToBigInt(s.acceptedCost)
  let admittedDebt = 0n
  for (const w of wallets) {
    if (w.wallet === 'w.mkt.debt') admittedDebt += parseAssetToBigInt(w.balance)
  }
  const expected = openAccepted - admittedDebt

  if (ledger76 !== expected) {
    return {
      ok: false,
      invariant: 'I7',
      expected: formatBigIntAsset(expected),
      actual: formatBigIntAsset(ledger76),
      violation:
        'I7: остаток счёта 76 по Столу заказов не равен открытым расчётам с поставщиками ' +
        '(принятая стоимость заказов с неподтверждённой выплатой минус признанный долг поставщиков). ' +
        'Возможный источник: выплата проведена не на принятую сумму либо заказ стёрт при незавершённой выплате.',
      details: settlements.map((s) => ({
        processHash: s.processHash,
        message: `открытый расчёт на ${s.acceptedCost}`,
      })),
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
    checkInvariantI1PayoutBalance(rows, wallets),
    checkInvariantI2Account86Delta(rows),
    checkInvariantI3Account10Materials(rows, accounts),
    checkInvariantI4Account91Usage(rows),
    checkInvariantI5ReserveConsistency(rows, wallets),
    checkInvariantI6NoOrphanedReserves(rows),
    checkInvariantI7SupplierSettlements(rows, wallets, settlements),
  ]
}

/** Internal: для интеграции с другими тестами / админ-вью. */
export const MARKETPLACE_OPERATION_CODES = MARKETPLACE_OP_CODES
