/**
 * Контрактный уровень: обеспечительная часть невыданного заказа лежит на
 * кошельке пайщика `w.mkt.secure` — «Обеспечительная часть в заказах»
 * (решение владельца 05.11.2026; реестр marketplace.order, случаи
 * mkt.order.secure.*).
 *
 * До правки заказ клал обеспечительную часть в общий пул кооператива
 * `w.mkt.fee`, и до выдачи пайщик не видел её ни на одном своём кошельке.
 * Тест проверяет путь денег по остаткам кошельков в цепи, а не только по
 * операциям:
 *
 *   • заказ — со свободного паевого на кошелёк под заказы ровно обеспечительная
 *     часть заказа, общий пул не меняется;
 *   • отмена до акцепта — с кошелька под заказы обратно на свободный паевой;
 *   • повторный marketplace::migrate при открытом заказе ничего не переносит:
 *     перенос считает разницу между суммой открытых заказов и остатком кошелька;
 *   • кошелёк под заказы держит выход пайщика (политика выхода — BLOCKER).
 *
 * Требует стенда после `reboot:extra` с сид-фазами docs-harness.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Ledger2 } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { pickOffer, placeOrder } from './marketplace/orderFlow'
import { CHAIRMAN, COOP, amount, ensureShareFunds, fromState, gqlAs, loginAs, waitForOps } from './marketplace/chainHelpers'
import { rub, userWallet } from './marketplace/periodHelpers'

const bc = new Blockchain(config.network, config.private_keys)

const BRANAME = 'krg'
const SECURE = 'w.mkt.secure'
const SHARE = 'w.mkt.share'
const POOL = 'w.mkt.fee'

const sidorov = fromState('sidorov')
const ekaterina = fromState('ekaterina')

let chairmanToken = ''
let ekaterinaToken = ''
let offerId = ''
let unitPrice = 0
const openOrders: string[] = []

/** Остаток кошелька кооператива (пула) в единицах актива. */
async function poolBalance(): Promise<bigint> {
  const rows: any[] = await bc.getTableRows('ledger2', COOP, 'wallets', 500)
  const row = rows.find(r => r.id === POOL)
  return row ? rub(amount(row.available)) : 0n
}

async function orderFee(orderId: string): Promise<bigint> {
  const d: any = await gqlAs(ekaterinaToken, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ membership_fee total_cost } }', { i: { order_id: orderId } })
  return rub(amount(d.marketplaceGetOrder.membership_fee))
}

async function cancel(orderId: string): Promise<void> {
  await gqlAs(ekaterinaToken, 'mutation($i:MarketplaceCancelOrderInput!){ marketplaceCancelOrder(input:$i){ tx_hash } }', { i: { order_id: orderId } })
}

describe('стол заказов — обеспечительная часть невыданного заказа на кошельке пайщика (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    chairmanToken = await loginAs(CHAIRMAN)
    ekaterinaToken = await loginAs(ekaterina)
    const offer = await pickOffer(chairmanToken, sidorov.account, BRANAME, 'Мёд цветочный')
    offerId = offer.id
    unitPrice = amount(offer.price_per_unit)
    await ensureShareFunds(ekaterina.account, unitPrice * 6, ekaterinaToken)
  }, 300_000)

  afterAll(async () => {
    for (const id of openOrders) await cancel(id).catch(() => {})
  })

  it('mkt.order.secure.01 — заказ кладёт обеспечительную часть на кошелёк пайщика под заказы, общий пул не меняется', async () => {
    const secureBefore = await userWallet(bc, SECURE, ekaterina.account)
    const poolBefore = await poolBalance()

    const placed = await placeOrder({ token: ekaterinaToken, who: ekaterina, offerId, quantity: 1, braname: BRANAME })
    openOrders.push(placed.orderId)
    await waitForOps(chairmanToken, placed.orderHash, ['o.mkt.fee'])
    const fee = await orderFee(placed.orderId)
    expect(fee > 0n, 'у заказа есть обеспечительная часть').toBe(true)

    expect(await userWallet(bc, SECURE, ekaterina.account) - secureBefore, 'кошелёк под заказы вырос ровно на обеспечительную часть').toBe(fee)
    expect(await poolBalance(), 'общий пул кооператива заказом не пополняется').toBe(poolBefore)
  }, 240_000)

  it('mkt.order.secure.02 — повторный перенос при открытом заказе ничего не двигает', async () => {
    const secureBefore = await userWallet(bc, SECURE, ekaterina.account)
    const poolBefore = await poolBalance()
    await bc.api.transact(
      { actions: [{ account: 'marketplace', name: 'migrate', authorization: [{ actor: 'marketplace', permission: 'active' }], data: {} }] },
      { blocksBehind: 3, expireSeconds: 60 },
    )
    expect(await userWallet(bc, SECURE, ekaterina.account)).toBe(secureBefore)
    expect(await poolBalance()).toBe(poolBefore)
  }, 120_000)

  it('mkt.order.secure.03 — отмена до акцепта возвращает обеспечительную часть с кошелька под заказы на свободный паевой', async () => {
    const orderId = openOrders[0]
    const fee = await orderFee(orderId)
    const secureBefore = await userWallet(bc, SECURE, ekaterina.account)
    const shareBefore = await userWallet(bc, SHARE, ekaterina.account)

    await cancel(orderId)
    openOrders.splice(0, 1)

    expect(secureBefore - await userWallet(bc, SECURE, ekaterina.account), 'с кошелька под заказы снята обеспечительная часть').toBe(fee)
    expect(await userWallet(bc, SHARE, ekaterina.account) - shareBefore >= fee, 'на свободный паевой вернулись обеспечительная часть и стоимость').toBe(true)
  }, 240_000)

  it('mkt.order.secure.04 — кошелёк под заказы держит выход пайщика', () => {
    const rule = Ledger2.LEDGER2_EXIT_WALLET_POLICY.find(r => r.wallet_name === SECURE)
    expect(rule?.policy).toBe('BLOCKER')
    const mapping = Ledger2.LEDGER2_USER_SHARED_PROGRAM_MAPPING.find(r => r.wallet_name === SECURE)
    expect(mapping?.required_program_id, 'кошелёк программы «Стол заказов»').toBe(2)
  })

  it('mkt.order.secure.05 — операции заказа, возврата и выдачи двигают кошелёк под заказы, а не общий пул', () => {
    const byCode = new Map(Ledger2.LEDGER2_OPERATION_REGISTRY.map(o => [o.code, o]))
    expect([byCode.get('o.mkt.fee')?.wallet_from, byCode.get('o.mkt.fee')?.wallet_to]).toEqual([SHARE, SECURE])
    expect([byCode.get('o.mkt.refund')?.wallet_from, byCode.get('o.mkt.refund')?.wallet_to]).toEqual([SECURE, SHARE])
    expect([byCode.get('o.mkt.todue')?.wallet_from, byCode.get('o.mkt.todue')?.wallet_to]).toEqual([SECURE, 'w.mkt.due'])
    expect([byCode.get('o.mig.mktsec')?.wallet_from, byCode.get('o.mig.mktsec')?.wallet_to]).toEqual([POOL, SECURE])
  })
})
