/**
 * CI-инварианты ledger2 marketplace.
 *
 * Юниты на off-chain агрегаторы I1..I6 в `marketplace-ledger2-invariants.ts`.
 * Никаких NestJS / TypeORM / реального chain'а — работа на синтетических
 * массивах `Ledger2OperationDTO`.
 *
 * Операции marketplace:
 *   - o.mkt.lock:   TRANSFER w.wal.share → w.mkt.order, Дт 80 / Кт 86
 *   - o.mkt.conv:   TRANSFER w.wal.share → w.mkt.member, Дт 80 / Кт 86
 *   - o.mkt.lockm:  TRANSFER w.mkt.member → w.mkt.order, без проводки
 *   - o.mkt.unlock: TRANSFER w.mkt.order → w.mkt.member, без проводки
 *   - o.mkt.consum: BURN w.mkt.order, Дт 86 / Кт 10
 *   - o.mkt.return: ISSUE → w.mkt.member, Дт 10 / Кт 86
 *   - o.mkt.wroff:  NONE, Дт 86 / Кт 10
 */

import { createHash, randomBytes } from 'node:crypto'
import {
  MarketplaceLedger2OperationRow,
  MarketplaceWalletRow,
  MarketplaceAccountRow,
  checkInvariantI1PayoutBalance,
  checkInvariantI2Account86Delta,
  checkInvariantI3Account10Materials,
  checkInvariantI4Account91Transit,
  checkInvariantI5ReserveConsistency,
  checkInvariantI6NoOrphanedReserves,
  checkAllMarketplaceLedger2Invariants,
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
 *   3. o.mkt.payout (Dr 86 / Cr 51, ISSUE w.mkt.payout) — задолженность поставщику
 *   4. o.mkt.consum (Dr 86 / Cr 10, BURN w.mkt.order) — выдача
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
      debitAccount: 80,
      creditAccount: 86,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.purch',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 86,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.payout',
      amount,
      walletFrom: null,
      walletTo: 'w.mkt.payout',
      debitAccount: 86,
      creditAccount: 51,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount,
      walletFrom: 'w.mkt.order',
      walletTo: null,
      debitAccount: 86,
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
      debitAccount: 80,
      creditAccount: 86,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.unlock',
      amount,
      walletFrom: 'w.mkt.order',
      walletTo: 'w.mkt.member',
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
      walletTo: 'w.mkt.member',
      debitAccount: 10,
      creditAccount: 86,
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
      debitAccount: 86,
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

describe('I1 — баланс w.mkt.payout', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: один payout без BURN → баланс = ISSUE amount', () => {
    const rows = happyPathOrderFlow(150)
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.payout', balance: '150.0000 RUB' }]
    const res = checkInvariantI1PayoutBalance(rows, wallets)
    expect(res.ok).toBe(true)
    expect(res.expected).toBe('150.0000 RUB')
  })

  it('happy path: payout + BURN → баланс = 0', () => {
    const rows = happyPathOrderFlow(150)
    rows.push({
      globalSequence: nextSeq(),
      action: 'walletop',
      operationCode: 'o.gw.payconf',
      processHash: newProcessHash(),
      walletFrom: 'w.mkt.payout',
      walletTo: null,
      quantity: '150.0000 RUB',
    })
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.payout', balance: '0.0000 RUB' }]
    const res = checkInvariantI1PayoutBalance(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('violation: ISSUE без соответствия в balance', () => {
    const rows = happyPathOrderFlow(150)
    const wallets: MarketplaceWalletRow[] = [{ wallet: 'w.mkt.payout', balance: '0.0000 RUB' }]
    const res = checkInvariantI1PayoutBalance(rows, wallets)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I1/)
    expect(res.expected).toBe('150.0000 RUB')
    expect(res.actual).toBe('0.0000 RUB')
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
      creditAccount: 86,
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
      creditAccount: 86,
    })
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '99.0000 RUB' }]
    const res = checkInvariantI3Account10Materials(purchOnly, accounts)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I3/)
  })
})

describe('I4 — транзитный счёт 91 (в marketplace больше не используется)', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: новый flow не задевает 91 → I4 пройден тривиально', () => {
    const rows: MarketplaceLedger2OperationRow[] = []
    for (let i = 0; i < 3; i++) rows.push(...happyPathOrderFlow(50 + i))
    for (let i = 0; i < 2; i++) rows.push(...returnFlow(20 + i))
    for (let i = 0; i < 2; i++) rows.push(...writeoffFlow(15 + i))
    const res = checkInvariantI4Account91Transit(rows)
    expect(res.ok).toBe(true)
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

  it('violation: consum без lock (двойная выдача / битый flow)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount: 30,
      walletFrom: 'w.mkt.order',
      walletTo: null,
      debitAccount: 86,
      creditAccount: 10,
    })
    const res = checkInvariantI6NoOrphanedReserves(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/consum без предшествующего lock/)
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
        walletTo: 'w.mkt.member',
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.consum',
        amount: 30,
        walletFrom: 'w.mkt.order',
        walletTo: null,
        debitAccount: 86,
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

  it('полный happy-path order flow: все 6 инвариантов ok', () => {
    const rows = happyPathOrderFlow(100)
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.payout', balance: '100.0000 RUB' },
      { wallet: 'w.mkt.order', balance: '0.0000 RUB' },
    ]
    const accounts: MarketplaceAccountRow[] = [{ accountId: 10, balance: '0.0000 RUB' }]
    const results = checkAllMarketplaceLedger2Invariants(rows, wallets, accounts)
    expect(results.map((r) => r.ok)).toEqual([true, true, true, true, true, true])
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

describe('I2 — marketplace-вклад в счёт 86 (sanity)', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('подсчёт debit/credit на 86 для полного flow', () => {
    const rows = happyPathOrderFlow(100)
    const res = checkInvariantI2Account86Delta(rows)
    expect(res.ok).toBe(true)
    // Cr 86: conv(+100) + purch(+100) = +200
    // Dr 86: payout(−100) + consum(−100) = −200
    // delta = 200 − 200 = 0
    expect(res.expected).toBe('0.0000 RUB')
  })
})
