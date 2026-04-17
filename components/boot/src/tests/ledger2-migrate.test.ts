import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { globalRamStats } from '../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../utils/randomHash'
import { sleep } from '../utils'

// -------- Контрактные константы (без зависимости от cooptypes-ledger2) --------
const LEDGER = 'ledger'
const LEDGER2 = 'ledger2'
const COOP = 'voskhod'

// План счетов legacy-ledger: SHARE_FUND=80, ENTRANCE_FEES=861, LONG_TERM_LOANS=67.
// Плюс BANK_ACCOUNT=51 — проверяем что он НЕ мигрирует (нет целевого фонда).
const LEGACY_ACCOUNTS = {
  SHARE_FUND: 80,
  ENTRANCE_FEES: 861,
  LONG_TERM_LOANS: 67,
  BANK_ACCOUNT: 51,
  MEMBER_DEBT: 751, // пассив без соответствия в LEDGER2_WALLET_REGISTRY → пропускается
} as const

// Соответствие ledger2 wallets (см. cpp/lib/core/ledger2/wallets.hpp).
const LEDGER2_WALLETS = {
  SHARE_FUND: 2,
  ENTRANCE_FEES: 3,
  LONG_TERM_LOANS: 6,
} as const

const blockchain = new Blockchain(config.network, config.private_keys)

async function ledgerAdd(accountId: number, quantity: string, hash: string, username: string) {
  return blockchain.api.transact(
    {
      actions: [
        {
          account: LEDGER,
          name: 'add',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: {
            coopname: COOP,
            account_id: accountId,
            quantity,
            comment: 'migration fixture',
            hash,
            username,
          },
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function ledgerBlock(accountId: number, quantity: string, hash: string, username: string) {
  return blockchain.api.transact(
    {
      actions: [
        {
          account: LEDGER,
          name: 'block',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: {
            coopname: COOP,
            account_id: accountId,
            quantity,
            comment: 'migration fixture block',
            hash,
            username,
          },
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function ledgerSub(accountId: number, quantity: string, hash: string, username: string) {
  return blockchain.api.transact(
    {
      actions: [
        {
          account: LEDGER,
          name: 'sub',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: {
            coopname: COOP,
            account_id: accountId,
            quantity,
            comment: 'migration fixture zero',
            hash,
            username,
          },
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

async function getLegacyLaccount(accountId: number) {
  const rows = await blockchain.getTableRows(LEDGER, COOP, 'accounts', 200)
  return rows.find((row: any) => Number(row.id) === accountId)
}

async function getLedger2Wallet(walletId: number) {
  const rows = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 200)
  return rows.find((row: any) => Number(row.id) === walletId)
}

async function getLedger2Meta() {
  const rows = await blockchain.getTableRows(LEDGER2, LEDGER2, 'meta', 10)
  return rows[0]
}

async function migrate() {
  return blockchain.api.transact(
    {
      actions: [
        {
          account: LEDGER2,
          name: 'migrate',
          authorization: [{ actor: LEDGER2, permission: 'active' }],
          data: {},
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}

function rubAmount(value: number): string {
  return `${value.toFixed(4)} RUB`
}

function parseAssetAmount(raw: unknown): number {
  if (!raw) return 0
  const [v] = String(raw).split(' ')
  return Number.parseFloat(v)
}

beforeAll(async () => {
  await blockchain.update_pass_instance()
}, 500_000)

afterAll(() => {
  console.log('\n📊 **RAM USAGE SUMMARY (ledger2-migrate)** 📊')
  let total = 0
  for (const [key, ram] of Object.entries(globalRamStats)) {
    console.log(`  ${key} = ${(ram / 1024).toFixed(2)} kb`)
    total += ram
  }
  console.log(`\n💾 TOTAL: ${(total / 1024).toFixed(2)} kb\n`)
})

describe('ledger2::migrate (Story 1.3 — миграция остатков с legacy-ledger)', () => {
  const user = 'ant' // seed-аккаунт из boot
  const seedShare = 50_000 // available на SHARE_FUND
  const seedEntrance = 7_500 // available на ENTRANCE_FEES (будет частично blocked)
  const entranceBlocked = 2_500
  const seedLoan = 12_000 // available на LONG_TERM_LOANS
  const seedBank = 3_333 // BANK_ACCOUNT — должен быть пропущен (нет целевого фонда)
  const seedMemberDebt = 100 // MEMBER_DEBT — должен быть пропущен (нет в маппере)

  // Baseline ledger2-балансов на момент старта теста (capital.test.ts мог
  // успеть накачать SHARE_FUND через apply()). Миграция должна ДОБАВИТЬ
  // seedShare поверх.
  let baselineShareWallet = 0
  let baselineEntranceWallet = 0
  let baselineLoanWallet = 0
  let meta: any
  let migrateWasAlreadyDone = false

  it('seed: пишем остатки в legacy-ledger (available, blocked, BANK, MEMBER_DEBT)', async () => {
    const metaBefore = await getLedger2Meta()
    migrateWasAlreadyDone = Boolean(metaBefore && Boolean(metaBefore.migrated))
    if (migrateWasAlreadyDone) {
      console.log('⏩ migrate уже выполнялся ранее — seed не влияет на wallets, тест проверит идемпотентность')
      return
    }

    const baselineShare = await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND)
    const baselineEntrance = await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES)
    const baselineLoan = await getLedger2Wallet(LEDGER2_WALLETS.LONG_TERM_LOANS)
    baselineShareWallet = parseAssetAmount(baselineShare?.available)
    baselineEntranceWallet = parseAssetAmount(baselineEntrance?.available)
    baselineLoanWallet = parseAssetAmount(baselineLoan?.available)

    await ledgerAdd(LEGACY_ACCOUNTS.SHARE_FUND, rubAmount(seedShare), generateRandomSHA256(), user)
    await ledgerAdd(LEGACY_ACCOUNTS.ENTRANCE_FEES, rubAmount(seedEntrance), generateRandomSHA256(), user)
    await ledgerBlock(LEGACY_ACCOUNTS.ENTRANCE_FEES, rubAmount(entranceBlocked), generateRandomSHA256(), user)
    await ledgerAdd(LEGACY_ACCOUNTS.LONG_TERM_LOANS, rubAmount(seedLoan), generateRandomSHA256(), user)
    await ledgerAdd(LEGACY_ACCOUNTS.BANK_ACCOUNT, rubAmount(seedBank), generateRandomSHA256(), user)
    await ledgerAdd(LEGACY_ACCOUNTS.MEMBER_DEBT, rubAmount(seedMemberDebt), generateRandomSHA256(), user)

    const share = await getLegacyLaccount(LEGACY_ACCOUNTS.SHARE_FUND)
    const entrance = await getLegacyLaccount(LEGACY_ACCOUNTS.ENTRANCE_FEES)
    const loan = await getLegacyLaccount(LEGACY_ACCOUNTS.LONG_TERM_LOANS)

    expect(parseAssetAmount(share?.available)).toBeCloseTo(seedShare, 4)
    expect(parseAssetAmount(entrance?.available)).toBeCloseTo(seedEntrance - entranceBlocked, 4)
    expect(parseAssetAmount(entrance?.blocked)).toBeCloseTo(entranceBlocked, 4)
    expect(parseAssetAmount(loan?.available)).toBeCloseTo(seedLoan, 4)
  })

  it('AC1: migrate() выполняется (первый вызов) либо уже выполнен', async () => {
    const metaBefore = await getLedger2Meta()

    if (!metaBefore || !Boolean(metaBefore.migrated)) {
      const res = await migrate()
      expect(res.transaction_id).toBeDefined()
    }
    else {
      console.log('⏩ migrate уже выполнялся ранее (migrated_coops =', metaBefore.migrated_coops, '), проверяем идемпотентность')
    }

    meta = await getLedger2Meta()
    expect(meta).toBeDefined()
    // ABI сериализует bool как 0/1, поэтому приводим к Boolean.
    expect(Boolean(meta.migrated)).toBe(true)
    expect(Number(meta.migrated_coops)).toBeGreaterThan(0)
  })

  it('AC2: SHARE_FUND (80 → 2) перенесён в ledger2::wallets', async () => {
    const wallet = await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND)
    expect(wallet).toBeDefined()
    expect(wallet.name).toBe('Паевой фонд')
    const actual = parseAssetAmount(wallet.available)
    // available = baseline (могут быть ISSUE из capital-тестов) + seedShare (из миграции)
    if (!migrateWasAlreadyDone) {
      expect(actual).toBeCloseTo(baselineShareWallet + seedShare, 4)
    }
    else {
      expect(actual).toBeGreaterThanOrEqual(0)
    }
  })

  it('AC3: ENTRANCE_FEES (861 → 3) перенесён с корректными available/blocked', async () => {
    const wallet = await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES)
    expect(wallet).toBeDefined()
    expect(wallet.name).toBe('Вступительные взносы')
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(wallet.available)).toBeCloseTo(baselineEntranceWallet + (seedEntrance - entranceBlocked), 4)
      expect(parseAssetAmount(wallet.blocked)).toBeCloseTo(entranceBlocked, 4)
    }
  })

  it('AC4: LONG_TERM_LOANS (67 → 6) перенесён', async () => {
    const wallet = await getLedger2Wallet(LEDGER2_WALLETS.LONG_TERM_LOANS)
    expect(wallet).toBeDefined()
    expect(wallet.name).toBe('Долгосрочные займы')
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(wallet.available)).toBeCloseTo(baselineLoanWallet + seedLoan, 4)
    }
  })

  it('AC5: BANK_ACCOUNT (51) — НЕ мигрирует (нет целевого фонда)', async () => {
    // У BANK_ACCOUNT в legacy id=51, в ledger2 нет wallet-а для кассы/банка,
    // учёт счёта 51 живёт в accounts через двойную запись из новых apply().
    const allWallets = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 200)
    const match = allWallets.find((w: any) => Number(w.id) === LEGACY_ACCOUNTS.BANK_ACCOUNT)
    expect(match).toBeUndefined()
  })

  it('AC6: MEMBER_DEBT (751) — НЕ мигрирует (нет в legacy_to_wallet_id)', async () => {
    const allWallets = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 200)
    const match = allWallets.find((w: any) => Number(w.id) === LEGACY_ACCOUNTS.MEMBER_DEBT)
    expect(match).toBeUndefined()
  })

  it('AC7: повторный вызов migrate() → "already migrated"', async () => {
    // EOSIO отклоняет транзакции с одинаковым TAPOS+data как duplicate,
    // поэтому даём блокчейну сдвинуть block_ref перед вторым вызовом.
    await sleep(1000)
    await expect(migrate()).rejects.toThrow(/already migrated/)
  })
})
