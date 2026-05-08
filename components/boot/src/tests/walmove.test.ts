/**
 * Integration: walmove (operation `o.adj.walmove`) — перевод между кошельками
 * одного бух.счёта (без Dr/Cr). Кейс: после регистрации пайщика на
 * `w.reg.minshr` (MIN_SHARE_FUND) и `w.wal.share` (SHARE_FUND_PAY) лежит
 * вместе X RUB на 80-м счёте, нам нужно перенести часть с MIN_SHARE_FUND на
 * SHARE_FUND_PAY (например, реструктуризация минимального паевого взноса
 * в обычный после criteria-аудита).
 *
 * Проверяет:
 *  - mutation walmoveWallets отрабатывает успешно
 *  - balance кошельков `w.reg.minshr` и `w.wal.share` изменился на amount
 *  - account 80 (Cr SHARE_FUND) ≡ не изменился (walmove не делает Dr/Cr inline-actions)
 *  - в getLedger2History появилась запись с operation_code='o.adj.walmove'
 *  - попытка перевода между кошельками разных счетов отбивается на backend
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { gql, loginAsChairman, waitUntil, type LoginResult } from './shared/apiClient'
import { registerUser } from './registrator/registerUser'
import { walmove } from './adjust/walmove'
import { getLedgerAccountById } from './wallet/walletUtils'
import { generateRandomUsername } from '../utils/randomUsername'

const COOP = 'voskhod'

const WALLET_MIN_SHARE_FUND = 'w.reg.minshr'
const WALLET_SHARE_FUND_PAY = 'w.wal.share'
const WALLET_ENTRANCE_FEES = 'w.reg.entry'

const ACCOUNT_SHARE_FUND = 80_000

const WALLETS_QUERY = `query($c:String!){
  getLedger2Wallets(coopname:$c){ id name available blocked }
}`

const HISTORY_QUERY = `query($i:GetLedger2HistoryInput!){
  getLedger2History(input:$i){
    items { globalSequence action operationCode processHash quantity memo }
    totalCount
  }
}`

const bc = new Blockchain(config.network, config.private_keys)
let login: LoginResult

beforeAll(async () => {
  await bc.update_pass_instance()
  login = await loginAsChairman()
}, 60_000)

afterAll(() => {})

function parseAsset(raw: string | null | undefined): number {
  if (!raw) return 0
  return Number.parseFloat(String(raw).split(' ')[0])
}

/**
 * Читаем балансы кошельков напрямую с блокчейна — parser отстаёт от head_block
 * на минуты, GraphQL-снимок ненадёжен для проверок «сразу после транзакции».
 */
async function getWalletAvailable(walletName: string): Promise<number> {
  const rows = await bc.getTableRows('ledger2', COOP, 'wallets', 200)
  const w = rows.find((r: { id: string }) => String(r.id) === walletName)
  return w ? parseAsset((w as { available: string }).available) : 0
}

describe('walmove (operation o.adj.walmove) — корректировка между кошельками одного бух.счёта', () => {
  it('переводит сумму между двумя кошельками счёта 80 без изменения balance счёта', async () => {
    // 1. Регистрируем нового пайщика — пополняет w.reg.minshr (MIN_SHARE_FUND) и w.reg.entry (ENTRANCE_FEES)
    const username = generateRandomUsername()
    const participant = await registerUser(bc, COOP, username)
    expect(participant).toBeDefined()

    // 2. Снимаем балансы ДО (с чейна, не из parser-снимка).
    const fromBefore = await getWalletAvailable(WALLET_MIN_SHARE_FUND)
    const toBefore = await getWalletAvailable(WALLET_SHARE_FUND_PAY)
    const accountBefore = parseAsset(
      (await getLedgerAccountById(bc, COOP, ACCOUNT_SHARE_FUND)).available,
    )

    // Сумма перевода = минимум, что ушёл при регистрации (parseFloat без множителей).
    const moveAmount = parseAsset(participant.minimum_amount)
    expect(moveAmount).toBeGreaterThan(0)
    expect(fromBefore).toBeGreaterThanOrEqual(moveAmount)

    // 3. Перевод w.reg.minshr → w.wal.share (оба кошелька на счёте 80)
    const memo = `walmove test: ${username}`
    const { processHash } = await walmove(
      login, COOP, COOP,
      WALLET_MIN_SHARE_FUND, WALLET_SHARE_FUND_PAY,
      `${moveAmount.toFixed(4)} RUB`, memo,
    )
    expect(processHash).toMatch(/^[0-9a-f]{64}$/)

    // 4. Балансы ПОСЛЕ — читаем напрямую с чейна (мгновенно после tx).
    const fromAfter = await getWalletAvailable(WALLET_MIN_SHARE_FUND)
    const toAfter = await getWalletAvailable(WALLET_SHARE_FUND_PAY)
    const accountAfter = parseAsset(
      (await getLedgerAccountById(bc, COOP, ACCOUNT_SHARE_FUND)).available,
    )

    expect(fromAfter).toBeCloseTo(fromBefore - moveAmount, 4)
    expect(toAfter).toBeCloseTo(toBefore + moveAmount, 4)
    // Главное свойство walmove (TRANSFER без Dr/Cr inline-actions, ADR-003): counterbalance бух.счёта не меняется.
    expect(accountAfter).toBeCloseTo(accountBefore, 4)

    // 5. Запись в реестре операций — parser отстаёт от head_block на 1-3с, ждём.
    const walmoveAction = await waitUntil(
      async () => {
        const data = await gql<{ getLedger2History: { items: any[] } }>(login.token, HISTORY_QUERY, {
          i: { coopname: COOP, processHash, actionNames: ['walmove'], limit: 10, page: 1 },
        })
        const item = data.getLedger2History.items.find((i) => i.action === 'walmove')
        return item ?? null
      },
      { timeoutMs: 60_000, label: 'walmove action в реестре' },
    )
    expect(walmoveAction).toBeDefined()
    expect(walmoveAction.memo).toBe(memo)
  }, 240_000)

  it('отказывает в переводе между кошельками разных бух.счетов (валидация в backend)', async () => {
    // w.reg.minshr (MIN_SHARE_FUND, на счёте 80) → w.reg.entry (ENTRANCE_FEES, на счёте 86) — разные счета.
    let errMessage = ''
    try {
      await walmove(
        login, COOP, COOP,
        WALLET_MIN_SHARE_FUND, WALLET_ENTRANCE_FEES,
        '0.0001 RUB', 'попытка walmove между счетами 80 и 86',
      )
    } catch (e) {
      errMessage = (e as Error).message
    }
    expect(errMessage).toContain('разным бух.счетам')
  }, 60_000)

  it('отказывает при пустом memo (контракт + backend требуют обоснование)', async () => {
    let errMessage = ''
    try {
      await walmove(
        login, COOP, COOP,
        WALLET_MIN_SHARE_FUND, WALLET_SHARE_FUND_PAY,
        '0.0001 RUB', '',
      )
    } catch (e) {
      errMessage = (e as Error).message
    }
    expect(errMessage.length).toBeGreaterThan(0)
  }, 60_000)
})
