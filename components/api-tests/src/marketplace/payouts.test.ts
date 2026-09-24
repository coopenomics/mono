/**
 * Выплаты поставщикам на столе совета (test-registry/marketplace.payouts.yaml):
 * разворот одной выплаты — сама выплата, оплаченный заказ и платёж в реестре
 * кассира. Выплата рождается закрывающей подписью приёмки: заказ ekaterina у
 * sidorov проходит приёмку на участке krg, после чего совет открывает её.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, ensureShareFunds, gql, gqlRaw, tokenOf } from '../core'
import type { Who } from '../core'
import { amount } from '../core/wallet'
import { acceptToCoop } from './flow'
import { checkoutSigned, fillCart, findActiveOffer, getOrder, settledWallets } from './order.helpers'

const DETAIL = `query($id:String!){
  marketplaceGetOutgoingPayment(id:$id){
    payment{ id order_id order_hash payee_account amount symbol status core_payment_id apl_reception_id }
    order{ id product_name quantity price_per_unit total_cost accepted_cost status delivery_point_name }
    core_payment{ id status quantity symbol memo created_at }
  }
}`

let member: Who
let supplier: Who
let operator: Who
let board: string
let orderId: string
let orderHash: string

beforeAll(async () => {
  member = ROLES.member()
  supplier = ROLES.supplier()
  operator = ROLES.branchChairman()
  board = await tokenOf(CHAIRMAN)
  const mt = await tokenOf(member)
  await ensureShareFunds(member.account, 5_000, mt)
  const potato = await findActiveOffer(mt, supplier.account, 'Картофель деревенский')
  await settledWallets(mt)
  await fillCart(mt, [{ offer_id: potato.id, quantity: 2 }])
  const placed = await checkoutSigned(member)
  orderId = placed.created_orders[0].id
  orderHash = placed.created_orders[0].order_hash
  await acceptToCoop({ supplier, operator, orderId, factQuantity: 2, factUnitPrice: amount(potato.price_per_unit) })
})

describe('выплаты поставщикам: разворот выплаты', () => {
  it(caseName('mkt.payouts.happy.01', 'совет открывает выплату: реквизиты, предмет поставки и платёж кассира по order_hash'), async () => {
    const list = await gql<any>(board, `query($f:MarketplaceListOutgoingPaymentsFilterInput){
      marketplaceListOutgoingPayments(filter:$f){ id order_id order_hash }
    }`, { f: { supplier_account: supplier.account } })
    const row = (list.marketplaceListOutgoingPayments as any[]).find(p => p.order_hash === orderHash)
    expect(row).toBeTruthy()

    const d = await gql<any>(board, DETAIL, { id: row.id })
    const detail = d.marketplaceGetOutgoingPayment
    expect(detail.payment.id).toBe(row.id)
    expect(detail.payment.order_id).toBe(orderId)
    expect(detail.payment.payee_account).toBe(supplier.account)
    expect(detail.payment.core_payment_id).toBeTruthy()

    const order = await getOrder(await tokenOf(member), orderId)
    expect(detail.order.id).toBe(orderId)
    expect(detail.order.product_name).toBe('Картофель деревенский')
    expect(detail.order.quantity).toBe(order.quantity)
    expect(detail.order.status).toBe(order.status)

    expect(detail.core_payment).not.toBeNull()
    expect(detail.core_payment.id).toBe(detail.payment.core_payment_id)
    expect(detail.core_payment.quantity).toBeCloseTo(amount(detail.payment.amount), 4)
    expect(detail.core_payment.symbol).toBe(detail.payment.symbol)
  })

  it(caseName('mkt.payouts.side.02', 'выплаты с таким идентификатором нет — ответ null без ошибки'), async () => {
    const r = await gqlRaw<any>(board, DETAIL, { id: crypto.randomUUID() })
    expect(r.errors).toEqual([])
    expect(r.data.marketplaceGetOutgoingPayment).toBeNull()
  })
})
