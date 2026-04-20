/**
 * Story 1.23 integration: ledger2 read-layer через GraphQL.
 *
 * Проверяет, что controller-резолверы `getLedger2Accounts`/`getLedger2Wallets`/
 * `getLedger2History` возвращают актуальный срез по кооперативу в тот же
 * момент, когда on-chain таблицы ledger2::accounts/wallets содержат данные.
 *
 * Почему важно: Epic 2 (генераторы отчётов) и desktop читают ТОЛЬКО через
 * SDK (не напрямую из цепочки), поэтому регрессия в read-слое скрывается
 * от unit-тестов сервиса и всплывает уже в отчётах/кабинете.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { gql, loginAsChairman } from './shared/apiClient'

const COOP = 'voskhod'

// Идентификаторы плана счетов — из Epic 1 (×1000 offset).
const ACCOUNT_BANK = 51_000
const ACCOUNT_SHARE_FUND = 80_000
const ACCOUNT_TARGET = 86_000
const ACCOUNT_TRANSIT = 99_000
const ACCOUNT_TYPE_ACTIVE = 0
const ACCOUNT_TYPE_PASSIVE = 1
const ACCOUNT_TYPE_ACTIVE_PASSIVE = 2

// Кошельки кооператива после миграции (Epic 1 addendum).
const WALLET_CASH_MAIN = 1001
const WALLET_SHARE_FUND_PAY = 2001
const WALLET_ENTRANCE_FEES = 3001

const ACCOUNTS_QUERY = `query($c:String!){
  getLedger2Accounts(coopname:$c){ id name balance debitBalance creditBalance accountType }
}`

const WALLETS_QUERY = `query($c:String!){
  getLedger2Wallets(coopname:$c){ id name available blocked }
}`

const HISTORY_QUERY = `query($i:GetLedger2HistoryInput!){
  getLedger2History(input:$i){
    items { action actionCode processHash accountId quantity }
    totalCount totalPages currentPage
  }
}`

const bc = new Blockchain(config.network, config.private_keys)
let token = ''

function parseAssetAmount(raw: unknown): number {
  if (!raw) return 0
  const [v] = String(raw).split(' ')
  return Number.parseFloat(v)
}

beforeAll(async () => {
  await bc.update_pass_instance()
  token = (await loginAsChairman()).token
}, 60_000)

afterAll(() => {})

describe('Ledger2 read-layer (Story 1.23)', () => {
  it('getLedger2Accounts: 51/80/86 получены с корректными типами и balance = ±(Dr−Cr)', async () => {
    const data = await gql<{ getLedger2Accounts: any[] }>(token, ACCOUNTS_QUERY, { c: COOP })
    const accounts = data.getLedger2Accounts
    expect(Array.isArray(accounts)).toBe(true)
    expect(accounts.length).toBeGreaterThanOrEqual(3)

    const byId = new Map<number, any>(accounts.map((a) => [Number(a.id), a]))

    const bank = byId.get(ACCOUNT_BANK)
    expect(bank, '51000 должен быть после migrate').toBeDefined()
    expect(bank.accountType).toBe(ACCOUNT_TYPE_ACTIVE)
    expect(parseAssetAmount(bank.balance)).toBeCloseTo(
      parseAssetAmount(bank.debitBalance) - parseAssetAmount(bank.creditBalance),
      4,
    )

    const share = byId.get(ACCOUNT_SHARE_FUND)
    expect(share, '80000 должен быть после migrate').toBeDefined()
    expect(share.accountType).toBe(ACCOUNT_TYPE_PASSIVE)
    expect(parseAssetAmount(share.balance)).toBeCloseTo(
      parseAssetAmount(share.creditBalance) - parseAssetAmount(share.debitBalance),
      4,
    )

    const target = byId.get(ACCOUNT_TARGET)
    expect(target, '86000 должен быть после migrate').toBeDefined()
    expect(target.accountType).toBe(ACCOUNT_TYPE_PASSIVE)
    expect(parseAssetAmount(target.balance)).toBeCloseTo(
      parseAssetAmount(target.creditBalance) - parseAssetAmount(target.debitBalance),
      4,
    )

    // 99000 может быть закрыт (обнулён по AC5 ledger2-migrate), но если
    // присутствует — должен быть ACTIVE_PASSIVE.
    const transit = byId.get(ACCOUNT_TRANSIT)
    if (transit) {
      expect(transit.accountType).toBe(ACCOUNT_TYPE_ACTIVE_PASSIVE)
    }
  }, 30_000)

  it('getLedger2Accounts: срез совпадает с on-chain ledger2::accounts (scope=coopname)', async () => {
    const onchain = await bc.getTableRows('ledger2', COOP, 'accounts', 500)
    const data = await gql<{ getLedger2Accounts: any[] }>(token, ACCOUNTS_QUERY, { c: COOP })
    const gqlAccounts = data.getLedger2Accounts
    expect(gqlAccounts.length).toBe(onchain.length)

    for (const chainRow of onchain) {
      const match = gqlAccounts.find((a) => Number(a.id) === Number(chainRow.id))
      expect(match, `счёт ${chainRow.id} отсутствует в GraphQL-срезе`).toBeDefined()
      expect(parseAssetAmount(match.balance)).toBeCloseTo(parseAssetAmount(chainRow.balance), 4)
      expect(parseAssetAmount(match.debitBalance)).toBeCloseTo(
        parseAssetAmount(chainRow.debit_balance),
        4,
      )
      expect(parseAssetAmount(match.creditBalance)).toBeCloseTo(
        parseAssetAmount(chainRow.credit_balance),
        4,
      )
    }
  }, 30_000)

  it('getLedger2Wallets: кошельки кооператива с актуальным available/blocked', async () => {
    const data = await gql<{ getLedger2Wallets: any[] }>(token, WALLETS_QUERY, { c: COOP })
    const wallets = data.getLedger2Wallets
    expect(Array.isArray(wallets)).toBe(true)
    expect(wallets.length).toBeGreaterThanOrEqual(3)

    const byId = new Map<number, any>(wallets.map((w) => [Number(w.id), w]))
    expect(byId.get(WALLET_CASH_MAIN), 'кошелёк кассы 1001').toBeDefined()
    expect(byId.get(WALLET_SHARE_FUND_PAY), 'кошелёк пая 2001').toBeDefined()
    expect(byId.get(WALLET_ENTRANCE_FEES), 'кошелёк вступ.взносов 3001').toBeDefined()

    const onchain = await bc.getTableRows('ledger2', COOP, 'wallets', 500)
    for (const w of onchain) {
      const match = byId.get(Number(w.id))
      if (!match) continue
      expect(parseAssetAmount(match.available)).toBeCloseTo(parseAssetAmount(w.available), 4)
      expect(parseAssetAmount(match.blocked)).toBeCloseTo(parseAssetAmount(w.blocked), 4)
    }
  }, 30_000)

  it('getLedger2History: непустая история + фильтр по actionCodes работает', async () => {
    const full = await gql<{ getLedger2History: any }>(token, HISTORY_QUERY, {
      i: { coopname: COOP, limit: 20, page: 1 },
    })
    const resp = full.getLedger2History
    expect(resp.totalCount).toBeGreaterThan(0)
    expect(resp.items.length).toBeGreaterThan(0)

    // Каждая операция — одного из 4 типов blockchain-actions ledger2.
    for (const op of resp.items) {
      expect(['apply', 'walletop', 'debit', 'credit']).toContain(op.action)
    }

    // Фильтр по actionCodes: если есть mig.opncash (миграция кассы), то
    // после фильтрации все записи — только apply с этим кодом.
    const filtered = await gql<{ getLedger2History: any }>(token, HISTORY_QUERY, {
      i: { coopname: COOP, actionCodes: ['mig.opncash'], limit: 10, page: 1 },
    })
    const fresp = filtered.getLedger2History
    expect(fresp.totalCount).toBeLessThanOrEqual(resp.totalCount)
    for (const op of fresp.items) {
      expect(op.actionCode).toBe('mig.opncash')
      expect(op.action).toBe('apply')
    }
  }, 30_000)

  it('getLedger2History: фильтр по accountId сужает результат до записей одного счёта', async () => {
    const filtered = await gql<{ getLedger2History: any }>(token, HISTORY_QUERY, {
      i: { coopname: COOP, accountId: ACCOUNT_BANK, limit: 20, page: 1 },
    })
    const resp = filtered.getLedger2History
    // Все возвращённые записи — это debit/credit по 51000 (apply/walletop не
    // имеют account_id → фильтр их исключает).
    for (const op of resp.items) {
      expect(Number(op.accountId)).toBe(ACCOUNT_BANK)
      expect(['debit', 'credit']).toContain(op.action)
    }
  }, 30_000)
})
