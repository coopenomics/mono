/**
 * CI-инварианты ledger2 marketplace.
 *
 * Юниты на off-chain агрегаторы I1..I7 в `marketplace-ledger2-invariants.ts`.
 * Никаких NestJS / TypeORM / реального chain'а — работа на синтетических
 * массивах `Ledger2OperationDTO`.
 *
 * Операции marketplace:
 *   - o.mkt.lock:   TRANSFER w.wal.share → w.mkt.order, без проводки (паевой остаётся на 80)
 *   - o.mkt.lockp:  TRANSFER w.mkt.share → w.mkt.order, без проводки
 *   - o.mkt.unlock: TRANSFER w.mkt.order → w.mkt.share, без проводки
 *   - o.mkt.consum: BURN w.mkt.order, Дт 86 / Кт 10
 *   - o.mkt.return: ISSUE → w.mkt.share, Дт 10 / Кт 80
 *   - o.mkt.wroff:  NONE, Дт 91 / Кт 10 (с 10.09.2026 — прочий расход, как уценка)
 */

import { createHash, randomBytes } from 'node:crypto'
import {
  MarketplaceLedger2OperationRow,
  MarketplaceWalletRow,
  MarketplaceAccountRow,
  checkInvariantI1SupplierThreads,
  checkInvariantI2Account86Usage,
  checkInvariantI3Account10Materials,
  checkInvariantI4Account91Usage,
  checkInvariantI5ReserveConsistency,
  checkInvariantI6NoOrphanedReserves,
  checkInvariantI7SupplierSettlements,
  checkAllMarketplaceLedger2Invariants,
  type MarketplaceOpenSettlementRow,
  parseAssetToBigInt,
  formatBigIntAsset,
} from './marketplace-ledger2-invariants'

const ASSET = (n: number | string): string => {
  if (typeof n === 'string') return n
  return `${n.toFixed(4)} RUB`
}

let seq = 100n
const nextSeq = (): string => (seq++).toString()

const newProcessHash = (): string =>
  createHash('sha256').update(randomBytes(32)).digest('hex')

function buildApplyTrio(params: {
  processHash: string
  operationCode: string
  amount: number | string
  walletFrom: string | null
  walletTo: string | null
  debitAccount: number | null
  creditAccount: number | null
}): MarketplaceLedger2OperationRow[] {
  const out: MarketplaceLedger2OperationRow[] = []
  out.push({
    globalSequence: nextSeq(),
    action: 'apply',
    operationCode: params.operationCode,
    processHash: params.processHash,
    quantity: ASSET(params.amount),
  })
  if (params.walletFrom || params.walletTo) {
    out.push({
      globalSequence: nextSeq(),
      action: 'walletop',
      operationCode: params.operationCode,
      processHash: params.processHash,
      walletFrom: params.walletFrom,
      walletTo: params.walletTo,
      quantity: ASSET(params.amount),
    })
  }
  if (params.debitAccount !== null) {
    out.push({
      globalSequence: nextSeq(),
      action: 'debit',
      operationCode: params.operationCode,
      processHash: params.processHash,
      accountId: params.debitAccount,
      quantity: ASSET(params.amount),
    })
  }
  if (params.creditAccount !== null) {
    out.push({
      globalSequence: nextSeq(),
      action: 'credit',
      operationCode: params.operationCode,
      processHash: params.processHash,
      accountId: params.creditAccount,
      quantity: ASSET(params.amount),
    })
  }
  return out
}

/**
 * Happy-path order flow (createorder → signsupp → signiss2):
 *   1. o.mkt.lock   (TRANSFER w.wal.share → w.mkt.order, Dr 80 / Cr 86) — резерв
 *   2. o.mkt.purch  (Dr 10 / Cr 86) — приёмка
 *   3. o.mkt.payout (Dr 76 / Cr 51, ISSUE w.mkt.payout) — оплата поставщику
 *   4. o.mkt.consum (Dr 80 / Cr 10, BURN w.mkt.order) — выдача
 */
function happyPathOrderFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const orderHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.lock',
      amount,
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debitAccount: null,
      creditAccount: null,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.purch',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 76,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.payout',
      amount,
      walletFrom: null,
      walletTo: 'w.mkt.payout',
      debitAccount: 76,
      creditAccount: 51,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount,
      walletFrom: 'w.mkt.order',
      walletTo: null,
      debitAccount: 80,
      creditAccount: 10,
    }),
  ]
}

function cancelOrderFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const orderHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.lock',
      amount,
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debitAccount: null,
      creditAccount: null,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.unlock',
      amount,
      walletFrom: 'w.mkt.order',
      walletTo: 'w.mkt.share',
      debitAccount: null,
      creditAccount: null,
    }),
  ]
}

function returnFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const requestHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: requestHash,
      operationCode: 'o.mkt.return',
      amount,
      walletFrom: null,
      walletTo: 'w.mkt.share',
      debitAccount: 10,
      creditAccount: 80,
    }),
  ]
}

function writeoffFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const proposalHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: proposalHash,
      operationCode: 'o.mkt.wroff',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 91,
      creditAccount: 10,
    }),
  ]
}

describe('parseAssetToBigInt', () => {
  it.each([
    ['100.0000 RUB', 1_000_000n],
    ['0.0000 RUB', 0n],
    ['1.2345 RUB', 12_345n],
    ['-100.0000 RUB', -1_000_000n],
    ['1234567.8901 RUB', 12_345_678_901n],
  ])('распарсивает "%s" в %s', (asset, expected) => {
    expect(parseAssetToBigInt(asset)).toBe(expected)
  })

  it('round-trip через formatBigIntAsset', () => {
    expect(formatBigIntAsset(1_000_000n)).toBe('100.0000 RUB')
    expect(formatBigIntAsset(-12_345n)).toBe('-1.2345 RUB')
  })

  it('пустая строка → 0', () => {
    expect(parseAssetToBigInt('')).toBe(0n)
    expect(parseAssetToBigInt(null)).toBe(0n)
    expect(parseAssetToBigInt(undefined)).toBe(0n)
  })

  it('кидает на невалидный asset', () => {
    expect(() => parseAssetToBigInt('100 RUB extra')).toThrow()
    expect(() => parseAssetToBigInt('abc')).toThrow()
  })
})

describe('I1 — расчёт с поставщиком по заказу закрывается принятой суммой (99D-15)', () => {
  beforeEach(() => {
    seq = 100n
  })

  /** Приёмка, затем удержание долга при инициации и выплата остатка кассиром. */
  function supplierThread(accepted: number, deduct: number, payout: number | null, processHash = newProcessHash()) {
    const rows = buildApplyTrio({
      processHash,
      operationCode: 'o.mkt.purch',
      amount: accepted,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 76,
    })
    if (deduct > 0) {
      rows.push(
        ...buildApplyTrio({
          processHash,
          operationCode: 'o.mkt.deduct',
          amount: deduct,
          walletFrom: 'w.mkt.debt',
          walletTo: null,
          debitAccount: null,
          creditAccount: null,
        }),
      )
    }
    if (payout !== null) {
      rows.push(
        ...buildApplyTrio({
          processHash,
          operationCode: 'o.mkt.payout',
          amount: payout,
          walletFrom: null,
          walletTo: 'w.mkt.payout',
          debitAccount: 76,
          creditAccount: 51,
        }),
      )
    }
    return rows
  }

  it('happy path: выплата на принятую сумму закрывает расчёт', () => {
    const res = checkInvariantI1SupplierThreads(happyPathOrderFlow(150))
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('ниток: 1, закрытых: 1')
  })

  it('happy path: удержание при инициации плюс выплата остатка = принятая стоимость', () => {
    const res = checkInvariantI1SupplierThreads(supplierThread(1000, 200, 800))
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('ниток: 1, закрытых: 1')
  })

  it('happy path: долг покрыл всю выплату — банковского перевода нет, расчёт закрыт удержанием', () => {
    const res = checkInvariantI1SupplierThreads(supplierThread(1000, 1000, null))
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('ниток: 1, закрытых: 1')
  })

  it('happy path: приёмка без выплаты — расчёт открыт, нарушения нет', () => {
    const res = checkInvariantI1SupplierThreads(supplierThread(1000, 0, null))
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('ниток: 1, закрытых: 0')
  })

  it('violation: выплата проведена на сумму выдачи вместо принятой', () => {
    const res = checkInvariantI1SupplierThreads(supplierThread(1000, 0, 800))
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I1/)
    expect(res.details?.[0]?.message).toMatch(/не закрывают принятую стоимость 1000\.0000 RUB/)
  })

  it('violation: удержание учтено дважды — выплата и удержание больше принятого', () => {
    // Сценарий задачи: две выплаты одному поставщику удержали один и тот же
    // долг; во второй нитке удержание с выплатой превышают принятую стоимость.
    const res = checkInvariantI1SupplierThreads(supplierThread(1000, 200, 1000))
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/не закрывают принятую стоимость/)
  })

  it('violation: выплата в нитке без приёмки', () => {
    const processHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash,
      operationCode: 'o.mkt.payout',
      amount: 500,
      walletFrom: null,
      walletTo: 'w.mkt.payout',
      debitAccount: 76,
      creditAccount: 51,
    })
    const res = checkInvariantI1SupplierThreads(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/без приёмки/)
  })

  it('violation: выплата проведена дважды', () => {
    const processHash = newProcessHash()
    const rows = [
      ...supplierThread(1000, 0, 1000, processHash),
      ...buildApplyTrio({
        processHash,
        operationCode: 'o.mkt.payout',
        amount: 1000,
        walletFrom: null,
        walletTo: 'w.mkt.payout',
        debitAccount: 76,
        creditAccount: 51,
      }),
    ]
    const res = checkInvariantI1SupplierThreads(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.some((d) => /выплата проведена 2 раза/.test(d.message))).toBe(true)
  })
})

describe('I3 — баланс счёта 10 (Материалы)', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: purch без consum → balance = purch amount', () => {
    const purchOnly = buildApplyTrio({
      processHash: newProcessHash(),
      operationCode: 'o.mkt.purch',
      amount: 200,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 76,
    })
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '200.0000 RUB' }]
    const res = checkInvariantI3Account10Materials(purchOnly, accounts)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('200.0000 RUB')
  })

  it('happy path: purch + consum → balance = 0', () => {
    const rows = happyPathOrderFlow(75)
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '0.0000 RUB' }]
    const res = checkInvariantI3Account10Materials(rows, accounts)
    expect(res.ok).toBe(true)
  })

  it('happy path: purch + return → balance = 2× purch (имущество вернулось на склад)', () => {
    const rows = [
      ...happyPathOrderFlow(100).filter(
        (r) => !['o.mkt.consum', 'o.mkt.payout'].includes(r.operationCode ?? ''),
      ),
    ]
    rows.push(...returnFlow(100))
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '200.0000 RUB' }]
    const res = checkInvariantI3Account10Materials(rows, accounts)
    expect(res.ok).toBe(true)
  })

  it('violation: balance расходится с историей', () => {
    const purchOnly = buildApplyTrio({
      processHash: newProcessHash(),
      operationCode: 'o.mkt.purch',
      amount: 200,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 76,
    })
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '99.0000 RUB' }]
    const res = checkInvariantI3Account10Materials(purchOnly, accounts)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I3/)
  })
})

describe('I4 — счёт 91: только уценка и признанные претензии', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: поставка, возврат и списание 91 не задевают → I4 пройден', () => {
    const rows: MarketplaceLedger2OperationRow[] = []
    for (let i = 0; i < 3; i++) rows.push(...happyPathOrderFlow(50 + i))
    for (let i = 0; i < 2; i++) rows.push(...returnFlow(20 + i))
    for (let i = 0; i < 2; i++) rows.push(...writeoffFlow(15 + i))
    const res = checkInvariantI4Account91Usage(rows)
    expect(res.ok).toBe(true)
  })

  it('happy path: списание скоропорта (o.mkt.wroff, Дт 91) — законная проводка по 91', () => {
    expect(checkInvariantI4Account91Usage(writeoffFlow(40)).ok).toBe(true)
  })

  it('happy path: уценка (o.mkt.loss, Дт 91) и признанная претензия (o.mkt.admit, Кт 91) — законные проводки по 91', () => {
    const rows = [
      ...buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.loss',
        amount: 12,
        walletFrom: null,
        walletTo: null,
        debitAccount: 91,
        creditAccount: 10,
      }),
      ...buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.admit',
        amount: 40,
        walletFrom: 'w.mkt.claim',
        walletTo: 'w.mkt.debt',
        debitAccount: 76,
        creditAccount: 91,
      }),
    ]
    const res = checkInvariantI4Account91Usage(rows)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('dr=12.0000 RUB / cr=40.0000 RUB')
  })

  it('violation: проводка по 91 в нитке без уценки и без претензии', () => {
    const rows = buildApplyTrio({
      processHash: newProcessHash(),
      operationCode: 'o.mkt.purch',
      amount: 30,
      walletFrom: null,
      walletTo: null,
      debitAccount: 91,
      creditAccount: 76,
    })
    const res = checkInvariantI4Account91Usage(rows)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I4/)
    expect(res.details?.[0]?.message).toMatch(/без уценки/)
  })
})

describe('I7 — долг поставщикам на счёте 76 равен открытым расчётам (99D-14)', () => {
  beforeEach(() => {
    seq = 100n
  })

  /** Приёмка без выплаты: долг поставщику открыт на принятую стоимость. */
  function acceptedOnly(amount: number, processHash = newProcessHash()) {
    return {
      processHash,
      rows: buildApplyTrio({
        processHash,
        operationCode: 'o.mkt.purch',
        amount,
        walletFrom: null,
        walletTo: null,
        debitAccount: 10,
        creditAccount: 76,
      }),
    }
  }

  it('happy path: приёмка без выплаты → 76 = принятая стоимость открытого заказа', () => {
    const { processHash, rows } = acceptedOnly(1000)
    const settlements: MarketplaceOpenSettlementRow[] = [{ processHash, acceptedCost: '1000.0000 RUB' }]
    const res = checkInvariantI7SupplierSettlements(rows, [], settlements)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('1000.0000 RUB')
  })

  it('happy path: выплата подтверждена на принятую сумму → 76 = 0, открытых расчётов нет', () => {
    const rows = happyPathOrderFlow(1000)
    const res = checkInvariantI7SupplierSettlements(rows, [], [])
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('0.0000 RUB')
  })

  it('happy path: признанная претензия ещё не удержана → 76 меньше на признанный долг', () => {
    const { processHash, rows } = acceptedOnly(1000)
    rows.push(
      ...buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.admit',
        amount: 200,
        walletFrom: 'w.mkt.claim',
        walletTo: 'w.mkt.debt',
        debitAccount: 76,
        creditAccount: 91,
      }),
    )
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.debt', balance: '200.0000 RUB' }]
    const settlements: MarketplaceOpenSettlementRow[] = [{ processHash, acceptedCost: '1000.0000 RUB' }]
    const res = checkInvariantI7SupplierSettlements(rows, wallets, settlements)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('800.0000 RUB')
  })

  it('happy path: заказ принят до появления accepted_cost — принятая стоимость берётся из истории (99D-15)', () => {
    const { processHash, rows } = acceptedOnly(1000)
    const settlements: MarketplaceOpenSettlementRow[] = [{ processHash, acceptedCost: null }]
    const res = checkInvariantI7SupplierSettlements(rows, [], settlements)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('1000.0000 RUB')
  })

  it('happy path: долг удержан при инициации, выплата остатка ждёт кассира — 76 меньше на удержанное', () => {
    const { processHash, rows } = acceptedOnly(1000, newProcessHash())
    rows.push(
      ...buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.admit',
        amount: 200,
        walletFrom: 'w.mkt.claim',
        walletTo: 'w.mkt.debt',
        debitAccount: 76,
        creditAccount: 91,
      }),
      ...buildApplyTrio({
        processHash,
        operationCode: 'o.mkt.deduct',
        amount: 200,
        walletFrom: 'w.mkt.debt',
        walletTo: null,
        debitAccount: null,
        creditAccount: null,
      }),
    )
    // Долг сожжён при инициации: кошелёк долга пуст, к переводу 800.
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.debt', balance: '0.0000 RUB' }]
    const settlements: MarketplaceOpenSettlementRow[] = [{ processHash, acceptedCost: '1000.0000 RUB' }]
    const res = checkInvariantI7SupplierSettlements(rows, wallets, settlements)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('800.0000 RUB')
  })

  it('violation (сценарий 1 задачи): выплата проведена на сумму выдачи вместо принятой — остаток зависает на 76', () => {
    const processHash = newProcessHash()
    const rows = [
      ...acceptedOnly(1000, processHash).rows,
      ...buildApplyTrio({
        processHash,
        operationCode: 'o.mkt.payout',
        amount: 800, // выдали 8 из 10 — старый контракт проводил бы факт выдачи
        walletFrom: null,
        walletTo: 'w.mkt.payout',
        debitAccount: 76,
        creditAccount: 51,
      }),
    ]
    const res = checkInvariantI7SupplierSettlements(rows, [], [])
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I7/)
    expect(res.expected).toBe('0.0000 RUB')
    expect(res.actual).toBe('200.0000 RUB')
  })

  it('violation (сценарий 2 задачи): заказ стёрт при незавершённой выплате — долг на 76 без заказа', () => {
    const { rows } = acceptedOnly(1000)
    // Проекция заказов открытого расчёта не видит: запись стёрта отказом.
    const res = checkInvariantI7SupplierSettlements(rows, [], [])
    expect(res.ok).toBe(false)
    expect(res.actual).toBe('1000.0000 RUB')
    expect(res.expected).toBe('0.0000 RUB')
  })
})

describe('I5 — согласованность резерва на w.mkt.order', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: lock + consum → reserve = 0', () => {
    const rows = happyPathOrderFlow(100)
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.order', balance: '0.0000 RUB' }]
    const res = checkInvariantI5ReserveConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('happy path: lock + unlock → reserve = 0', () => {
    const rows = cancelOrderFlow(50)
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.order', balance: '0.0000 RUB' }]
    const res = checkInvariantI5ReserveConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('happy path: один активный lock → reserve = amount', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.lock',
      amount: 60,
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debitAccount: null,
      creditAccount: null,
    })
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.order', balance: '60.0000 RUB' }]
    const res = checkInvariantI5ReserveConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('violation: lock есть, reserve = 0 (фантомный unlock)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.lock',
      amount: 60,
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debitAccount: null,
      creditAccount: null,
    })
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.order', balance: '0.0000 RUB' }]
    const res = checkInvariantI5ReserveConsistency(rows, wallets)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I5/)
  })
})

describe('I6 — нет orphan o.mkt.lock', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: lock + consum', () => {
    const res = checkInvariantI6NoOrphanedReserves(happyPathOrderFlow(100))
    expect(res.ok).toBe(true)
  })

  it('happy path: lock + unlock', () => {
    const res = checkInvariantI6NoOrphanedReserves(cancelOrderFlow(50))
    expect(res.ok).toBe(true)
  })

  it('happy path: только lock (активный Order, ещё не закрытый)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.lock',
      amount: 30,
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debitAccount: null,
      creditAccount: null,
    })
    const res = checkInvariantI6NoOrphanedReserves(rows)
    expect(res.ok).toBe(true)
  })

  it('happy path: резерв из свободного паевого (lockp) + consum — выдача с резервом', () => {
    // Задача 99D-15: заказ, оплаченный целиком из свободного паевого «Стола
    // заказов», содержит только lockp; прежняя редакция считала это выдачей
    // без резерва и писала нарушение каждый час.
    const orderHash = newProcessHash()
    const rows: MarketplaceLedger2OperationRow[] = [
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.lockp',
        amount: 30,
        walletFrom: 'w.mkt.share',
        walletTo: 'w.mkt.order',
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.consum',
        amount: 30,
        walletFrom: 'w.mkt.order',
        walletTo: null,
        debitAccount: 80,
        creditAccount: 10,
      }),
    ]
    expect(checkInvariantI6NoOrphanedReserves(rows).ok).toBe(true)
  })

  it('violation: consum без lock (двойная выдача / битый flow)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount: 30,
      walletFrom: 'w.mkt.order',
      walletTo: null,
      debitAccount: 80,
      creditAccount: 10,
    })
    const res = checkInvariantI6NoOrphanedReserves(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/consum без предшествующего резерва/)
  })

  it('violation: lock + unlock + consum (двойное закрытие)', () => {
    const orderHash = newProcessHash()
    const rows: MarketplaceLedger2OperationRow[] = [
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.lock',
        amount: 30,
        walletFrom: 'w.wal.share',
        walletTo: 'w.mkt.order',
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.unlock',
        amount: 30,
        walletFrom: 'w.mkt.order',
        walletTo: 'w.mkt.share',
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.consum',
        amount: 30,
        walletFrom: 'w.mkt.order',
        walletTo: null,
        debitAccount: 80,
        creditAccount: 10,
      }),
    ]
    const res = checkInvariantI6NoOrphanedReserves(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/двойное закрытие/)
  })
})

describe('checkAllMarketplaceLedger2Invariants — батч', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('полный happy-path order flow: все 7 инвариантов ok', () => {
    const rows = happyPathOrderFlow(100)
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.payout', balance: '100.0000 RUB' },
      { wallet: 'w.mkt.order', balance: '0.0000 RUB' },
    ]
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '0.0000 RUB' }]
    const results = checkAllMarketplaceLedger2Invariants(rows, wallets, accounts)
    expect(results.map((r) => r.invariant)).toEqual(['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'])
    expect(results.map((r) => r.ok)).toEqual([true, true, true, true, true, true, true])
  })

  it('повторение order flow N раз с разными amounts — все инварианты ok', () => {
    const rows: MarketplaceLedger2OperationRow[] = []
    let totalPurch = 0n
    for (let i = 0; i < 5; i++) {
      const amount = 50 + i * 10
      rows.push(...happyPathOrderFlow(amount))
      totalPurch += parseAssetToBigInt(`${amount.toFixed(4)} RUB`)
    }
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.payout', balance: formatBigIntAsset(totalPurch) },
      { wallet: 'w.mkt.order', balance: '0.0000 RUB' },
    ]
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '0.0000 RUB' }]
    const results = checkAllMarketplaceLedger2Invariants(rows, wallets, accounts)
    for (const r of results) expect(r.ok).toBe(true)
  })

  it('пустой ввод — все инварианты ok (vacuous truth)', () => {
    const results = checkAllMarketplaceLedger2Invariants([], [], [])
    for (const r of results) expect(r.ok).toBe(true)
  })
})

describe('I2 — счёт 86: только перевод в членский, удержание при отказе и списание скоропорта', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: полный flow заказа счёт 86 не задевает', () => {
    // Паевая модель: тело заказа не заходит на 86 (lock без проводки, purch
    // Дт 10 / Кт 76, payout Дт 76 / Кт 51, consum Дт 80 / Кт 10).
    const res = checkInvariantI2Account86Usage(happyPathOrderFlow(100))
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('dr=0.0000 RUB / cr=0.0000 RUB')
  })

  it('happy path: перевод в членский и удержание при отказе (Кт 86) — законные проводки; списание скоропорта 86 не задевает', () => {
    const orderHash = newProcessHash()
    const rows: MarketplaceLedger2OperationRow[] = [
      ...writeoffFlow(40),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.conv',
        amount: 100,
        walletFrom: 'w.wal.share',
        walletTo: 'w.mkt.member',
        debitAccount: 80,
        creditAccount: 86,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.penal',
        amount: 50,
        walletFrom: 'w.mkt.order',
        walletTo: 'w.mkt.fee',
        debitAccount: 80,
        creditAccount: 86,
      }),
    ]
    const res = checkInvariantI2Account86Usage(rows)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('dr=0.0000 RUB / cr=150.0000 RUB')
  })

  it('violation: дебет 86 в нитке Стола заказов — у программы такого движения нет', () => {
    // Так выглядело списание скоропорта до 10.09.2026: счёт 86 уменьшался,
    // а кошельки на нём — нет, и сальдо расходилось с кошельками навсегда.
    const res = checkInvariantI2Account86Usage(
      buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.wroff',
        amount: 40,
        walletFrom: null,
        walletTo: null,
        debitAccount: 86,
        creditAccount: 10,
      }),
    )
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/дебет 86/)
  })

  it('violation: проводка по 86 в нитке Стола заказов вне трёх допустимых операций', () => {
    // Приёмка легла на 86 вместо 76 — так выглядел бы реестр до перевода
    // закупки на счёт расчётов.
    const res = checkInvariantI2Account86Usage(
      buildApplyTrio({
        processHash: newProcessHash(),
        operationCode: 'o.mkt.purch',
        amount: 100,
        walletFrom: null,
        walletTo: null,
        debitAccount: 10,
        creditAccount: 86,
      }),
    )
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I2/)
    expect(res.details?.[0]?.message).toMatch(/кредит 86/)
  })

  it('проводка без кода привязывается к операции по родительскому apply', () => {
    // В живой истории у строк debit/credit кода нет — есть ссылка на apply.
    const processHash = newProcessHash()
    const applySeq = nextSeq()
    const rows: MarketplaceLedger2OperationRow[] = [
      { globalSequence: applySeq, action: 'apply', operationCode: 'o.mkt.penal', processHash, quantity: '40.0000 RUB' },
      { globalSequence: nextSeq(), action: 'debit', processHash, accountId: 80, quantity: '40.0000 RUB', parentApplyGlobalSequence: applySeq },
      { globalSequence: nextSeq(), action: 'credit', processHash, accountId: 86, quantity: '40.0000 RUB', parentApplyGlobalSequence: applySeq },
    ]
    expect(checkInvariantI2Account86Usage(rows).ok).toBe(true)
  })
})
