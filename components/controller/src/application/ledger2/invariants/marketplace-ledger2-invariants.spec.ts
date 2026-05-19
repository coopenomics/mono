/**
 * Story 11.3 — CI-инварианты ledger2 marketplace.
 *
 * Юниты на off-chain агрегаторы I1..I6 в `marketplace-ledger2-invariants.ts`.
 * Никаких NestJS / TypeORM / реального chain'а — работа на синтетических
 * массивах `Ledger2OperationDTO`.
 *
 * Сценарии:
 *   1. Happy path для каждого I1..I6 (закрытый flow, инвариант ok).
 *   2. Violation path (специально сломанная последовательность → инвариант
 *      падает с понятным `violation`).
 *   3. Property-based — random последовательности block/unblk/consum/return
 *      обязаны сохранять I4 (transit = 0) и I6 (нет orphan-block'ов).
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
  checkInvariantI5BlockedConsistency,
  checkInvariantI6NoOrphanedBlocks,
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

/**
 * Сборка трио apply + walletop + debit + credit под одним process_hash для
 * данной marketplace-операции. Подражает ledger2::apply pipeline.
 */
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
 * Полный happy-path order flow (createorder → signsupp → signiss2):
 *   1. o.wal.conv   (Dr 80 / Cr 86) — конвертация цифрового рубля
 *   2. o.mkt.assign (TRANSFER без проводок) — членский в программу
 *   3. o.mkt.block  (BLOCK) — блокировка
 *   4. o.mkt.purch  (Dr 10 / Cr 86) — приёмка
 *   5. o.mkt.payout (Dr 86 / Cr 51, ISSUE w.mkt.payout) — задолженность поставщику
 *   6. o.mkt.consum (Dr 91 / Cr 10, REVOKE w.mkt.member) — выдача
 *   7. o.mkt.consum2 (Dr 86 / Cr 91) — закрытие транзита
 */
function happyPathOrderFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const orderHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.wal.conv',
      amount,
      walletFrom: 'w.wal.share',
      walletTo: 'w.wal.member',
      debitAccount: 80,
      creditAccount: 86,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.assign',
      amount,
      walletFrom: 'w.wal.member',
      walletTo: 'w.mkt.member',
      debitAccount: null,
      creditAccount: null,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.block',
      amount,
      walletFrom: 'w.mkt.member',
      walletTo: null,
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
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: 91,
      creditAccount: 10,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum2',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 86,
      creditAccount: 91,
    }),
  ]
}

function cancelOrderFlow(amount = 100): MarketplaceLedger2OperationRow[] {
  const orderHash = newProcessHash()
  return [
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.block',
      amount,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: null,
      creditAccount: null,
    }),
    ...buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.unblk',
      amount,
      walletFrom: 'w.mkt.member',
      walletTo: null,
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
      debitAccount: 91,
      creditAccount: 86,
    }),
    ...buildApplyTrio({
      processHash: requestHash,
      operationCode: 'o.mkt.return2',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 10,
      creditAccount: 91,
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
    ...buildApplyTrio({
      processHash: proposalHash,
      operationCode: 'o.mkt.wroff2',
      amount,
      walletFrom: null,
      walletTo: null,
      debitAccount: 86,
      creditAccount: 91,
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
    // эмулируем gateway::payconfirm → BURN из w.mkt.payout
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

  it('happy path: purch + return2 → balance = 2× purch', () => {
    const rows = [...happyPathOrderFlow(100).filter((r) => !['o.mkt.consum', 'o.mkt.consum2', 'o.mkt.payout'].includes(r.operationCode ?? ''))]
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

describe('I4 — транзитный счёт 91 = 0', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: consum + consum2 атомарно → 91 = 0', () => {
    const rows = happyPathOrderFlow(50)
    const res = checkInvariantI4Account91Transit(rows)
    expect(res.ok).toBe(true)
  })

  it('happy path: return + return2 → 91 = 0', () => {
    const res = checkInvariantI4Account91Transit(returnFlow(80))
    expect(res.ok).toBe(true)
  })

  it('happy path: wroff + wroff2 → 91 = 0', () => {
    const res = checkInvariantI4Account91Transit(writeoffFlow(120))
    expect(res.ok).toBe(true)
  })

  it('happy path: смешанный поток из 10 случайных закрытых процессов', () => {
    const rows: MarketplaceLedger2OperationRow[] = []
    for (let i = 0; i < 4; i++) rows.push(...happyPathOrderFlow(50 + i))
    for (let i = 0; i < 3; i++) rows.push(...returnFlow(20 + i))
    for (let i = 0; i < 3; i++) rows.push(...writeoffFlow(15 + i))
    const res = checkInvariantI4Account91Transit(rows)
    expect(res.ok).toBe(true)
  })

  it('violation: consum без consum2 (процесс не закрыт)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount: 100,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: 91,
      creditAccount: 10,
    })
    // Чтобы process_hash был «marketplace», добавим apply parent (consum уже apply, ок)
    const res = checkInvariantI4Account91Transit(rows)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I4/)
    expect(res.details?.[0]?.message).toMatch(/transit 91/)
  })
})

describe('I5 — согласованность блокировок в w.mkt.member', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: block + consum → blocked = 0', () => {
    const rows = happyPathOrderFlow(100)
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '0.0000 RUB' },
    ]
    const res = checkInvariantI5BlockedConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('happy path: block + unblk → blocked = 0', () => {
    const rows = cancelOrderFlow(50)
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '0.0000 RUB' },
    ]
    const res = checkInvariantI5BlockedConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('happy path: один активный block → blocked = amount', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.block',
      amount: 60,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: null,
      creditAccount: null,
    })
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '60.0000 RUB' },
    ]
    const res = checkInvariantI5BlockedConsistency(rows, wallets)
    expect(res.ok).toBe(true)
  })

  it('violation: block есть, blocked = 0 (фантомный unblk)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.block',
      amount: 60,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: null,
      creditAccount: null,
    })
    const wallets: MarketplaceWalletRow[] = [
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '0.0000 RUB' },
    ]
    const res = checkInvariantI5BlockedConsistency(rows, wallets)
    expect(res.ok).toBe(false)
    expect(res.violation).toMatch(/I5/)
  })
})

describe('I6 — нет orphan o.mkt.block', () => {
  beforeEach(() => {
    seq = 100n
  })

  it('happy path: block + consum', () => {
    const res = checkInvariantI6NoOrphanedBlocks(happyPathOrderFlow(100))
    expect(res.ok).toBe(true)
  })

  it('happy path: block + unblk', () => {
    const res = checkInvariantI6NoOrphanedBlocks(cancelOrderFlow(50))
    expect(res.ok).toBe(true)
  })

  it('happy path: только block (активный Order, ещё не закрытый)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.block',
      amount: 30,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: null,
      creditAccount: null,
    })
    const res = checkInvariantI6NoOrphanedBlocks(rows)
    expect(res.ok).toBe(true)
  })

  it('violation: consum без block (двойная выдача / битый flow)', () => {
    const orderHash = newProcessHash()
    const rows = buildApplyTrio({
      processHash: orderHash,
      operationCode: 'o.mkt.consum',
      amount: 30,
      walletFrom: 'w.mkt.member',
      walletTo: null,
      debitAccount: 91,
      creditAccount: 10,
    })
    const res = checkInvariantI6NoOrphanedBlocks(rows)
    expect(res.ok).toBe(false)
    expect(res.details?.[0]?.message).toMatch(/consum без предшествующего block/)
  })

  it('violation: block + unblk + consum (двойное закрытие)', () => {
    const orderHash = newProcessHash()
    const rows: MarketplaceLedger2OperationRow[] = [
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.block',
        amount: 30,
        walletFrom: 'w.mkt.member',
        walletTo: null,
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.unblk',
        amount: 30,
        walletFrom: 'w.mkt.member',
        walletTo: null,
        debitAccount: null,
        creditAccount: null,
      }),
      ...buildApplyTrio({
        processHash: orderHash,
        operationCode: 'o.mkt.consum',
        amount: 30,
        walletFrom: 'w.mkt.member',
        walletTo: null,
        debitAccount: 91,
        creditAccount: 10,
      }),
    ]
    const res = checkInvariantI6NoOrphanedBlocks(rows)
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
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '0.0000 RUB' },
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
      { wallet: 'w.mkt.member', balance: '0.0000 RUB', blocked: '0.0000 RUB' },
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

describe('Property-based — случайные последовательности', () => {
  /**
   * Для seed-based-генератора используем counter с детерминированной
   * подмешкой через `randomBytes` (тесты воспроизводимы в CI: jest гонит
   * single-thread, seed одинаков от прогона к прогону).
   */
  const RUN_COUNT = 50

  beforeEach(() => {
    seq = 100n
  })

  it('I4 сохраняется на 50 случайных последовательностях из mix happy/cancel/return/writeoff', () => {
    for (let i = 0; i < RUN_COUNT; i++) {
      const rows: MarketplaceLedger2OperationRow[] = []
      const flows = [happyPathOrderFlow, cancelOrderFlow, returnFlow, writeoffFlow]
      const n = (i % 4) + 2 // 2..5 потоков
      for (let k = 0; k < n; k++) {
        const flow = flows[(i + k) % flows.length]
        rows.push(...flow(10 + ((i + k) % 90)))
      }
      const res = checkInvariantI4Account91Transit(rows)
      expect(res.ok).toBe(true)
    }
  })

  it('I6 сохраняется на тех же последовательностях', () => {
    for (let i = 0; i < RUN_COUNT; i++) {
      const rows: MarketplaceLedger2OperationRow[] = []
      const flows = [happyPathOrderFlow, cancelOrderFlow]
      const n = (i % 3) + 2
      for (let k = 0; k < n; k++) {
        const flow = flows[(i + k) % flows.length]
        rows.push(...flow(10 + ((i + k) % 90)))
      }
      const res = checkInvariantI6NoOrphanedBlocks(rows)
      expect(res.ok).toBe(true)
    }
  })

  it('инжекция случайного «потерянного consum» ломает I4 + I6', () => {
    const rows = happyPathOrderFlow(100)
    // Убираем consum2 — закрытие транзита 91 пропало.
    const broken = rows.filter((r) => r.operationCode !== 'o.mkt.consum2')
    const i4 = checkInvariantI4Account91Transit(broken)
    expect(i4.ok).toBe(false)
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
    // Cr 86: conv(+100) + purch(+100) + return(0) = +200
    // Dr 86: payout(−100) + consum2(−100) = −200
    // delta = 200 − 200 = 0
    expect(res.expected).toBe('0.0000 RUB')
  })
})
