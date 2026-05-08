import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { globalRamStats } from '../utils/getTotalRamUsage'
import { generateRandomSHA256 } from '../utils/randomHash'
import { sleep } from '../utils'
import { LedgerAccountType } from './wallet/walletUtils'

// =============================================================================
// Epic 1 addendum (пересмотр 2026-04-20): миграция переведена на 6 прямых
// TRANSIT_* проводок без транзитного счёта 99 и без кошелька CASH_MAIN.
// 2026-04-27: numeric wallet id → eosio::name w.<contract>.<waltype>.
//
// Семантика:
//   TRANSIT_MIN_SHARE  → Dr 51 / Cr 80, ISSUE MIN_SHARE_FUND   (w.reg.minshr)
//   TRANSIT_BLAGOROST  → Dr 51 / Cr 80, ISSUE BLAGOROST_FUND (w.cap.blago)
//   TRANSIT_SHARE      → Dr 51 / Cr 80, ISSUE SHARE_FUND_PAY   (w.wal.share)
//   TRANSIT_ENTRY      → Dr 51 / Cr 86, ISSUE ENTRANCE_FEES    (w.reg.entry)
//   TRANSIT_COMMITMENT → Dr 08 / Cr 80, ISSUE GENERATOR_FUND (w.cap.gen)
//
// План счетов: 04, 08, 51, 58, 80, 86 (99 удалён как лишний транзит).
// РИД-перенос (w.wal.sharid + o.mig.rid) удалён в Story 1.1: legacy 80 без РИД-части (ADR-009).
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
  SHARE_FUND_PAY: 'w.wal.share',
  MIN_SHARE_FUND: 'w.reg.minshr',
  ENTRANCE_FEES: 'w.reg.entry',
} as const

const LEDGER2_ACCOUNTS = {
  INTANGIBLE_ASSETS: 4_000,
  NON_CURRENT_INVESTMENTS: 8_000,
  BANK_ACCOUNT: 51_000,
  FINANCIAL_INVESTMENTS: 58_000,
  SHARE_FUND: 80_000,
  TARGET_RECEIPTS: 86_000,
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

async function getLedger2Wallet(walletName: string) {
  const rows = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 200)
  return rows.find((row: any) => String(row.id) === walletName)
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

describe('ledger2::migrate (пересмотр 2026-05-05: 3 TRANSIT_* без 99/CASH_MAIN/РИД)', () => {
  // Типовой кейс «без РИД»: cash_legacy = entry_legacy + share_money.
  // share_legacy = share_money (legacy 80 без РИД-части — обязательное условие ADR-009).
  const seedCash = 5_000   // → Dr 51 суммарно
  const seedEntry = 1_500  // → Cr 86 (через TRANSIT_ENTRY)
  const seedShare = seedCash - seedEntry // 3_500 → Cr 80 (распределится на MIN+SHARE, без РИД)

  let baselineCashAcc = 0
  let baselineShareAcc = 0
  let baselineEntryAcc = 0
  let baselineWalletsTotal = 0
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

    // Baseline Σ wallets (w.wal.share + w.reg.minshr + w.reg.entry): testnet-boot мог создать
    // начальные балансы для пайщиков. AC8 проверяет что seed добавил ровно
    // seedCash сверху baseline.
    const sharePayW = await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND_PAY)
    const minShareW = await getLedger2Wallet(LEDGER2_WALLETS.MIN_SHARE_FUND)
    const entryW = await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES)
    baselineWalletsTotal =
      parseAssetAmount(sharePayW?.available) +
      parseAssetAmount(minShareW?.available) +
      parseAssetAmount(entryW?.available)

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

  it('AC2: account 51 (BANK_ACCOUNT, ACTIVE) получил весь seedCash на debit', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(LedgerAccountType.ACTIVE)
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.debit_balance)).toBeCloseTo(baselineCashAcc + seedCash, 4)
    }
  })

  it('AC3: account 80 (SHARE_FUND, PASSIVE) получил seedShare на credit (прямой Cr 80)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(LedgerAccountType.PASSIVE)
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.credit_balance)).toBeCloseTo(baselineShareAcc + seedShare, 4)
    }
  })

  it('AC4: account 86 (TARGET_RECEIPTS, PASSIVE) получил seedEntry на credit (через TRANSIT_ENTRY)', async () => {
    const acc = await getLedger2Account(LEDGER2_ACCOUNTS.TARGET_RECEIPTS)
    expect(acc).toBeDefined()
    expect(Number(acc.account_type)).toBe(LedgerAccountType.PASSIVE)
    if (!migrateWasAlreadyDone) {
      expect(parseAssetAmount(acc.credit_balance)).toBeCloseTo(baselineEntryAcc + seedEntry, 4)
    }
  })

  it('AC5: счёт 99 (OPENING_TRANSIT) больше не существует — пересмотр 2026-04-20 удалил его из плана счетов', async () => {
    // Старая схема делала 99 как транзит; новая — прямые проводки. Запись 99 в
    // accounts2 не должна появляться вообще. Проверка через getTableRows на id=99_000.
    const rows = await blockchain.getTableRows(LEDGER2, COOP, 'accounts', 500)
    const legacy99 = rows.find((row: any) => Number(row.id) === 99_000)
    expect(legacy99, 'account 99_000 (OPENING_TRANSIT) не должен существовать после migrate').toBeUndefined()
  })

  it('AC6: балансы accounts2 консистентны — 51 (Dr) == 80 + 86 (Cr) после миграции', async () => {
    const cashAcc = await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT)
    const shareAcc = await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND)
    const entryAcc = await getLedger2Account(LEDGER2_ACCOUNTS.TARGET_RECEIPTS)

    expect(cashAcc, 'BANK_ACCOUNT (51) не найден после migrate').toBeDefined()
    expect(shareAcc, 'SHARE_FUND (80) не найден после migrate').toBeDefined()
    expect(entryAcc, 'TARGET_RECEIPTS (86) не найден после migrate').toBeDefined()

    // Consistency инвариант: balance == ±(debit_balance − credit_balance).
    expect(parseAssetAmount(cashAcc.balance)).toBeCloseTo(parseAssetAmount(cashAcc.debit_balance) - parseAssetAmount(cashAcc.credit_balance), 4)
    expect(parseAssetAmount(shareAcc.balance)).toBeCloseTo(parseAssetAmount(shareAcc.credit_balance) - parseAssetAmount(shareAcc.debit_balance), 4)
    expect(parseAssetAmount(entryAcc.balance)).toBeCloseTo(parseAssetAmount(entryAcc.credit_balance) - parseAssetAmount(entryAcc.debit_balance), 4)
  })

  it('AC7: wallet CASH_MAIN больше НЕ существует — убран из плана кошельков', async () => {
    // Пересмотр 2026-04-20: CASH_MAIN удалён, счёт 51 ведётся только в accounts2.
    // Никаких wallet-записей под устаревшим именем быть не должно.
    const rows = await blockchain.getTableRows(LEDGER2, COOP, 'wallets', 200)
    const legacyCashMain = rows.find((row: any) => String(row.id) === 'w.wal.cash')
    expect(legacyCashMain, 'wallet CASH_MAIN не должен существовать после migrate').toBeUndefined()
  })

  it('AC8: Σ wallets (w.wal.share + w.reg.minshr + w.reg.entry) == baseline + seedCash (инвариант миграции)', async () => {
    if (migrateWasAlreadyDone) {
      console.log('⏩ migrate был ранее — AC8 проверка Σ wallets пропущена (неизвестен baseline)')
      return
    }
    const sharePayWallet = await getLedger2Wallet(LEDGER2_WALLETS.SHARE_FUND_PAY)
    const minShareWallet = await getLedger2Wallet(LEDGER2_WALLETS.MIN_SHARE_FUND)
    const entryWallet = await getLedger2Wallet(LEDGER2_WALLETS.ENTRANCE_FEES)

    const totalWallets =
      parseAssetAmount(sharePayWallet?.available) +
      parseAssetAmount(minShareWallet?.available) +
      parseAssetAmount(entryWallet?.available)

    // Инвариант: seed добавил ровно seedCash в Σ money-кошельков над baseline.
    // Baseline снимался ДО seed (в первом it) — теперь baseline + seedCash.
    // Благорост (w.cap.blago) и Генератор (w.cap.gen) в эту сумму не входят — они
    // emplace-ятся отдельно из soviet::progwallets без участия в бух-проводках.
    expect(totalWallets).toBeCloseTo(baselineWalletsTotal + seedCash, 4)
  })

  it('AC9: повторный migrate() после полного прогона → тихий no-op', async () => {
    const metaBefore = await getLedger2Meta()
    expect(metaBefore).toBeDefined()
    expect(Boolean(metaBefore.migrated)).toBe(true)
    const cashBefore = parseAssetAmount(
      (await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT))?.debit_balance,
    )
    const shareBefore = parseAssetAmount(
      (await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND))?.credit_balance,
    )

    await sleep(1000)
    const res = await migrate()
    expect(res.transaction_id).toBeDefined()

    const metaAfter = await getLedger2Meta()
    expect(Boolean(metaAfter.migrated)).toBe(true)
    expect(Number(metaAfter.migrated_coops)).toBe(Number(metaBefore.migrated_coops))
    expect(Number(metaAfter.last_migrated_coop_index)).toBe(Number(metaBefore.last_migrated_coop_index))

    const cashAfter = parseAssetAmount(
      (await getLedger2Account(LEDGER2_ACCOUNTS.BANK_ACCOUNT))?.debit_balance,
    )
    const shareAfter = parseAssetAmount(
      (await getLedger2Account(LEDGER2_ACCOUNTS.SHARE_FUND))?.credit_balance,
    )
    expect(cashAfter).toBeCloseTo(cashBefore, 4)
    expect(shareAfter).toBeCloseTo(shareBefore, 4)
  })
})
