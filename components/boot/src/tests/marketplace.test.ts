/**
 * Marketplace contract suite — Эпик 11 Stories 11.2 + 11.3 MVP «Стол заказов».
 *
 * Story 11.2: append-only трассировка каждой ledger2-операции через
 * ProcessRegistry — `blockchain_actions` фиксирует apply + walletop + debit
 * + credit с общим process_hash; `getLedger2History(processHash)` возвращает
 * полный trace процесса.
 *
 * Story 11.3: off-chain агрегация 6 инвариантов ledger2 на marketplace flow.
 * Никаких сумм по всем кошелькам в смарт-контракте; всё считается в
 * vitest-harness через `getLedger2Accounts` / `getLedger2Wallets` /
 * `getLedger2History`.
 *
 * Сценарии full-flow (purchase / consume / return / writeoff) — todo;
 * подключаются после merge marketplace2 → main mono-ai-5 (helpers под
 * 13 marketplace-операций).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import Blockchain from '../blockchain'
import config from '../configs'
import { loginAsChairman } from './shared/apiClient'
import {
  assertMarketplaceOperationsRegistered,
  MARKETPLACE_OPERATION_CODES,
} from './marketplace/trace'
import { runAllInvariants } from './marketplace/invariants'

const COOP = 'voskhod'
const bc = new Blockchain(config.network, config.private_keys)
let token = ''

beforeAll(async () => {
  await bc.update_pass_instance()
  const login = await loginAsChairman()
  token = login.token
}, 60_000)

afterAll(() => {})

describe('Marketplace MVP — Story 11.2 трассировка ledger2', () => {
  it('cooptypes регистрирует все 13 marketplace operation_codes', () => {
    // Statически-определённый guard: рассинхронизация cooptypes/contract
    // ловится сразу, без необходимости разворачивать blockchain.
    expect(() => assertMarketplaceOperationsRegistered()).not.toThrow()
    expect(MARKETPLACE_OPERATION_CODES.length).toBe(13)
  })

  it.todo(
    'p.mkt.supply flow: createorder → acceptbatch → signsupp → signiss1 → signiss2 → blockchain_actions содержит трассу всех 13 операций',
  )

  it.todo(
    'p.mkt.return flow: submretrn → accretrn → blockchain_actions содержит трассу o.mkt.return + o.mkt.return2 с parent_order_id',
  )

  it.todo(
    'p.mkt.wroff flow: propwroff → execwroff → blockchain_actions содержит трассу o.mkt.wroff + o.mkt.wroff2',
  )

  it.todo(
    'compensating forward: o.mkt.return пишется как новое событие с parent_order_id, НЕ через ledger2::revert',
  )
})

describe('Marketplace MVP — Story 11.3 инварианты ledger2 (off-chain)', () => {
  it('инварианты сходятся на текущем состоянии кооператива', async () => {
    const results = await runAllInvariants(token, COOP)
    expect(results).toHaveLength(6)
    for (const r of results) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.name} — ${r.detail}`)
    }
    // Жёсткий expect только на инварианты, требующие сходимости в любой момент
    // (даже до запуска marketplace-сценариев): I4 (acc.91 = 0), I6 (нет
    // зависших blocked). I1/I2/I3 проверяются после full-flow сценариев,
    // I5 — после внедрения marketplaceListOrders в тесты.
    const i4 = results.find((r) => r.name.startsWith('I4'))
    const i6 = results.find((r) => r.name.startsWith('I6'))
    expect(i4?.ok, `I4 нарушен: ${i4?.detail}`).toBe(true)
    expect(i6?.ok, `I6 нарушен: ${i6?.detail}`).toBe(true)
  }, 60_000)

  it.todo(
    'после полного supply flow: I1 (sum w.mkt.payout) сходится с Σpurch − Σpayout.confirmed',
  )

  it.todo(
    'после consum + return: I2 (marketplace-вклад в 86) и I3 (acc.10) сходятся',
  )

  it.todo(
    'edge case insufficient_funds: попытка createorder без баланса → o.mkt.block falls; reload state не должен оставить зависший blocked (I6)',
  )

  it.todo(
    'edge case partial decline: только часть единиц партии принята → consum срабатывает только на эти единицы; I2/I3 учитывают fact_quantity',
  )

  it.todo(
    'composite через 91: consum + consum2 в одной транзакции, 91 обнулён сразу (I4)',
  )
})
