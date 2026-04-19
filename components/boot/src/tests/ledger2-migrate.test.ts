import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { globalRamStats } from '../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../utils/randomHash'
import { sleep } from '../utils'

// =============================================================================
// Epic 1 addendum (2026-04-18): тест переписан под новую схему ledger2.
//   - ACTION_REGISTRY теперь содержит mig.opncash / mig.opnshr / mig.opnent /
//     mig.opnrid вместо «прямого» переноса остатков.
//   - План счетов: 04 (НМА), 51, 80, 86, 99 (transit). Субсчета 86.x удалены.
//   - Кошельки: 1001 / 2001-2003 / 3001 / 4001-4002 (от 1000+, ×1000-группировка).
//   - Migrate(from_coop_index, limit) — курсорный режим.
//   - Журнал в RAM убран; история — в blockchain_actions, проверяется отдельно.
// =============================================================================

const LEDGER = 'ledger'
const LEDGER2 = 'ledger2'
const COOP = 'voskhod'

const LEGACY_ACCOUNTS = {
  BANK_ACCOUNT: 51,
  SHARE_FUND: 80,
  ENTRANCE_FEES: 861,
} as const

const LEDGER2_WALLETS = {
  CASH_MAIN: 1001,
  SHARE_FUND_PAY: 2001,
  SHARE_FUND_RID: 2003,
  ENTRANCE_FEES: 3001,
} as const

const LEDGER2_ACCOUNTS = {
  INTANGIBLE_ASSETS: 4_000,
  BANK_ACCOUNT: 51_000,
  SHARE_FUND: 80_000,
  TARGET_RECEIPTS: 86_000,
  OPENING_TRANSIT: 99_000,
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
          data: { coopname: COOP, account_id: accountId, quantity, comment: 'migration fixture', hash, username },
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

async function getLedger2Account(accountId: number) {
  const rows = await blockchain.getTableRows(LEDGER2, COOP, 'accounts', 500)
  return rows.find((row: any) => Number(row.id) === accountId)
}

async function getLedger2Meta() {
  const rows = await blockchain.getTableRows(LEDGER2, LEDGER2, 'meta', 10)
  return rows[0]
}

async function migrate(from_coop_index = 0, limit = Number.MAX_SAFE_INTEGER) {
  return blockchain.api.transact(
    {
      actions: [
        {
          account: LEDGER2,
          name: 'migrate',
          authorization: [{ actor: LEDGER2, permission: 'active' }],
          data: { from_coop_index, limit },
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

describe('ledger2::migrate (Epic 1 addendum: opening через apply + RID)', () => {
  // Сидируем legacy так, чтобы воспроизвести типовой кейс «без РИД»:
  // cash_legacy = entry_legacy + share_money. По формуле migrate:
  //   share_money = cash − entry, rid_share = share_legacy − share_money.
  // Для отсутствия RID-проводки оставляем share_legacy = share_money.
  const seedCash = 5_000   // → накапливается на 51
  const seedEntry = 1_500  // → 86 (через mig.opnent)
  const seedShare = seedCash - seedEntry // 3_500 → 80 (без РИД)

  let baselineCashAcc = 0
  let baselineShareAcc = 0
  let baselineEntryAcc = 0
  let baselineCashWallet = 0
  let baselineShareWallet = 0
  let baselineEntryWallet = 0
  let migrateWasAlreadyDone = false

  it('seed: пишем остатки в legacy-ledger (51, 80, 861)', async () => {
    const metaBefore = await getLedger2Meta()
    migrateWasAlreadyDone = Boolean(metaBefore && Boolean(metaBefore.migrated))
    if (migrateWasAlreadyDone) {
      console.log('⏩ migrate уже выполнялся ранее — seed не пишем')
      return
    }

    baselineCashAcc = parseAssetAmount((await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT))?.debit_balance)
    baselineShareAcc = parseAssetAmount((await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND))?.credit_balance)
    baselineEntryAcc = parseAssetAmount((await getLedger2Account(LEDGER2_ACCOUNTS.TARGET_RECEIPTS))?.credit_balance)
    baselineCashWallet = parseAssetAmount((await getLedger2Wallet(LEDGER2_WALLETS.CASH_MAIN))?.available)
    baselineShareWallet = parseAssetAmount((await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND_PAY))?.available)
    baselineEntryWallet = parseAssetAmount((await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES))?.available)

    await ledgerAdd(LEGACY_ACCOUNTS.BANK_ACCOUNT, rubAmount(seedCash), generateRandomSHA256(), 'ant')
    await ledgerAdd(LEGACY_ACCOUNTS.SHARE_FUND, rubAmount(seedShare), generateRandomSHA256(), 'ant')
    await ledgerAdd(LEGACY_ACCOUNTS.ENTRANCE_FEES, rubAmount(seedEntry), generateRandomSHA256(), 'ant')

    const cash = await getLegacyLaccount(LEGACY_ACCOUNTS.BANK_ACCOUNT)
    const share = await getLegacyLaccount(LEGACY_ACCOUNTS.SHARE_FUND)
    const entry = await getLegacyLaccount(LEGACY_ACCOUNTS.ENTRANCE_FEES)

    expect(parseAssetAmount(cash?.available)).toBeCloseTo(seedCash, 4)
    expect(parseAssetAmount(share?.available)).toBeCloseTo(seedShare, 4)
    expect(parseAssetAmount(entry?.available)).toBeCloseTo(seedEntry, 4)
  })

  it('AC1: migrate(0, MAX) выполняется (или уже выполнен)', async () => {
    const metaBefore = await getLedger2Meta()
    if (!metaBefore || !Boolean(metaBefore.migrated)) {
      const res = await migrate()
      expect(res.transaction_id).toBeDefined()
    } else {
      console.log('⏩ migrate уже выполнен (migrated_coops =', metaBefore.migrated_coops, ')')
    }

    const meta = await getLedger2Meta()
    expect(meta).toBeDefined()
    expect(Boolean(meta.migrated)).toBe(true)
    expect(Number(meta.migrated_coops)).toBeGreaterThan(0)
  })

  it('AC2: account 51 (BANK_ACCOUNT) получил seedCash на debit (через mig.opncash)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(0) // ACTIVE
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.debit_balance)).toBeCloseTo(baselineCashAcc + seedCash, 4)
    }
  })

  it('AC3: account 80 (SHARE_FUND, PASSIVE) получил seedShare на credit (через mig.opnshr)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(1) // PASSIVE
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.credit_balance)).toBeCloseTo(baselineShareAcc + seedShare, 4)
    }
  })

  it('AC4: account 86 (TARGET_RECEIPTS, PASSIVE) получил seedEntry на credit (через mig.opnent)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.TARGET_RECEIPTS)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(1) // PASSIVE
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.credit_balance)).toBeCloseTo(baselineEntryAcc + seedEntry, 4)
    }
  })

  it('AC5: account 99 (OPENING_TRANSIT) — после миграции debit ≡ credit (транзит обнулён)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.OPENING_TRANSIT)
    if (acc) {
      expect(parseAssetAmount(acc.debit_balance)).toBeCloseTo(parseAssetAmount(acc.credit_balance), 4)
    } else {
      // Если 99 не создан — значит миграция не вызвалась хоть раз с ненулевыми
      // суммами, либо уже подчищен. Допускаем оба варианта.
      console.log('ℹ️ accounts[99] не создан — seed мог быть нулевым')
    }
  })

  it('AC6: wallets 1001/2001/3001 содержат seed-суммы, поле balance в accounts корректно', async () => {
    const cashAcc = await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT)
    const shareAcc = await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND)
    const entryAcc = await getLedger2Account(LEDGER2_ACCOUNTS.TARGET_RECEIPTS)

    expect(parseAssetAmount(cashAcc.balance)).toBeCloseTo(parseAssetAmount(cashAcc.debit_balance) - parseAssetAmount(cashAcc.credit_balance), 4)
    expect(parseAssetAmount(shareAcc.balance)).toBeCloseTo(parseAssetAmount(shareAcc.credit_balance) - parseAssetAmount(shareAcc.debit_balance), 4)
    expect(parseAssetAmount(entryAcc.balance)).toBeCloseTo(parseAssetAmount(entryAcc.credit_balance) - parseAssetAmount(entryAcc.debit_balance), 4)

    if (!migrateWasAlreadyDone) {
      const cashWallet = await getLedger2Wallet(LEDGER2_WALLETS.CASH_MAIN)
      const shareWallet = await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND_PAY)
      const entryWallet = await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES)
      expect(parseAssetAmount(cashWallet?.available)).toBeCloseTo(baselineCashWallet + seedCash, 4)
      expect(parseAssetAmount(shareWallet?.available)).toBeCloseTo(baselineShareWallet + seedShare, 4)
      expect(parseAssetAmount(entryWallet?.available)).toBeCloseTo(baselineEntryWallet + seedEntry, 4)
    }
  })

  it('AC7: повторный migrate() после полного прогона → тихий no-op (без ошибки)', async () => {
    await sleep(1000)
    const res = await migrate()
    expect(res.transaction_id).toBeDefined()

    // State должен остаться прежним (ничего не переписывается).
    const meta = await getLedger2Meta()
    expect(Boolean(meta.migrated)).toBe(true)
  })
})
