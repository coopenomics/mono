/**
 * Выплата поставщику пакетом (test-registry/marketplace.payouts.yaml, решение
 * владельца 19.11.2026): заказы поставщика за сутки объединяются в одну
 * выплату — один платёж кассиру. Выплата рождается обходом узла в начале
 * следующих суток, поэтому набор идёт в фазе полигона со сжатым временем
 * (сутки стенда — минута); в настоящем времени её не дождаться.
 *
 * Два заказа ekaterina у sidorov проходят приёмку на участке krg. Обход
 * объединяет их в одну выплату: сумма — принятые стоимости, платёж кассиру один.
 * Отказ кассира возвращает заказы, и они попадают в выплату следующих суток;
 * подтверждение кассира закрывает выплату.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, ensureShareFunds, gql, gqlRaw, tokenOf, transact, waitFor } from '../core'
import type { Who } from '../core'
import { COOP } from '../core/env'
import { COOP_SIGNER, amount } from '../core/wallet'
import { acceptToCoop } from './flow'
import { checkoutSigned, fillCart, seedOffer, settledWallets } from './order.helpers'
import { cashierPaid } from '../documents/docs-reports.helpers'

const COMPRESSED = (Number(process.env.BLACKBOX_STAND_MONTH_SECONDS) || 0) > 0
/** Сутки стенда в фазе со сжатым временем — минута; ждём с запасом на шаг обхода. */
const BATCH_WAIT_MS = 4 * 60_000

const PAYMENT_FIELDS = 'id payment_hash orders_count order_ids payee_account amount withheld_amount symbol status core_payment_id decline_reason'
const LIST = `query($f:MarketplaceListOutgoingPaymentsFilterInput){
  marketplaceListOutgoingPayments(filter:$f){ ${PAYMENT_FIELDS} }
}`
const DETAIL = `query($id:String!){
  marketplaceGetOutgoingPayment(id:$id){
    payment{ ${PAYMENT_FIELDS} }
    orders{ id product_name quantity total_cost accepted_cost status }
    core_payment{ id status quantity symbol memo }
  }
}`

let member: Who
let supplier: Who
let operator: Who
let board: string
const orderIds: string[] = []
const accepted = new Map<string, number>()

async function payoutsOf(): Promise<any[]> {
  const d = await gql<any>(board, LIST, { f: { supplier_account: supplier.account } })
  return d.marketplaceListOutgoingPayments as any[]
}

/** Выплата, в которую входят все заказы набора, в нужном состоянии. */
async function waitPayout(status: string, exclude: string[] = []): Promise<any> {
  return waitFor(async () => {
    const list = await payoutsOf()
    return list.find(p => !exclude.includes(p.id) && p.status === status && orderIds.every(id => p.order_ids.includes(id))) ?? null
  }, { timeoutMs: BATCH_WAIT_MS, intervalMs: 5_000, label: `выплата поставщику в состоянии ${status}` })
}

describe.skipIf(!COMPRESSED)('выплата поставщику пакетом за сутки', () => {
  let firstPayout: any

  beforeAll(async () => {
    member = ROLES.member()
    supplier = ROLES.supplier()
    operator = ROLES.branchChairman()
    board = await tokenOf(CHAIRMAN)
    const mt = await tokenOf(member)
    await ensureShareFunds(member.account, 10_000, mt)
    const potato = await seedOffer(supplier.account, 'Картофель деревенский')
    const price = amount(potato.price_per_unit)
    for (const qty of [2, 3]) {
      await settledWallets(mt)
      await fillCart(mt, [{ offer_id: potato.id, quantity: qty }])
      const placed = await checkoutSigned(member)
      const id = placed.created_orders[0].id
      orderIds.push(id)
      await acceptToCoop({ supplier, operator, orderId: id, factQuantity: qty, factUnitPrice: price })
      accepted.set(id, qty * price)
    }
  }, 900_000)

  it(caseName('mkt.payouts.happy.01', 'заказы поставщика за сутки — одна выплата и один платёж кассиру на сумму принятого'), async () => {
    firstPayout = await waitPayout('PENDING')
    expect(firstPayout.payee_account).toBe(supplier.account)
    const total = orderIds.reduce((s, id) => s + (accepted.get(id) ?? 0), 0)
    expect(amount(firstPayout.amount) + amount(firstPayout.withheld_amount), 'сумма выплаты — принятые стоимости заказов').toBeCloseTo(total, 4)
    expect(firstPayout.core_payment_id, 'платёж в реестре кассира заведён').toBeTruthy()

    const d = await gql<any>(board, DETAIL, { id: firstPayout.id })
    const detail = d.marketplaceGetOutgoingPayment
    expect(detail.orders.map((o: any) => o.id).sort()).toEqual(expect.arrayContaining([...orderIds].sort()))
    expect(detail.core_payment.quantity, 'кассир переводит ровно сумму выплаты').toBeCloseTo(amount(firstPayout.amount), 4)

    // Один платёж кассиру на поставщика: других ждущих выплат с этими заказами нет.
    const pendingWithOrders = (await payoutsOf()).filter(p => p.status === 'PENDING' && p.order_ids.some((id: string) => orderIds.includes(id)))
    expect(pendingWithOrders).toHaveLength(1)
  }, BATCH_WAIT_MS + 60_000)

  it(caseName('mkt.payouts.side.07', 'кассир отказал — заказы возвращаются и попадают в выплату следующих суток'), async () => {
    await transact(COOP_SIGNER, [{
      account: 'gateway',
      name: 'outdecline',
      data: { coopname: COOP, outcome_hash: firstPayout.payment_hash, reason: 'Неверные реквизиты' },
    }])
    const declined = await waitFor(async () => {
      const p = (await payoutsOf()).find(x => x.id === firstPayout.id)
      return p?.status === 'DECLINED' ? p : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'выплата отклонена' })
    expect(declined.decline_reason).toBe('Неверные реквизиты')

    const next = await waitPayout('PENDING', [firstPayout.id])
    expect(next.id).not.toBe(firstPayout.id)
    expect(next.payment_hash).not.toBe(firstPayout.payment_hash)
    firstPayout = next
  }, BATCH_WAIT_MS + 120_000)

  it(caseName('mkt.payouts.happy.02', 'кассир подтвердил перевод — выплата оплачена, заказы больше не ждут выплаты'), async () => {
    await cashierPaid(firstPayout.core_payment_id)
    const paid = await waitFor(async () => {
      const p = (await payoutsOf()).find(x => x.id === firstPayout.id)
      return p?.status === 'COMPLETED' ? p : null
    }, { timeoutMs: 90_000, intervalMs: 3_000, label: 'выплата подтверждена кассиром' })
    expect(paid.status).toBe('COMPLETED')

    // Следующие сутки новой выплаты с этими заказами не дают: обязательство закрыто.
    // timing: schedule — проверка отсутствия: ждём две сутки стенда и смотрим, что обход не завёл новую выплату
    await new Promise(r => setTimeout(r, 2 * 60_000))
    const again = (await payoutsOf()).filter(p => p.id !== firstPayout.id && p.status !== 'DECLINED' && p.order_ids.some((id: string) => orderIds.includes(id)))
    expect(again).toEqual([])
  }, 300_000)
})

describe('выплаты поставщикам: разворот выплаты', () => {
  beforeAll(async () => {
    board = await tokenOf(CHAIRMAN)
  })

  it(caseName('mkt.payouts.side.02', 'выплаты с таким идентификатором нет — ответ null без ошибки'), async () => {
    const r = await gqlRaw<any>(board, DETAIL, { id: crypto.randomUUID() })
    expect(r.errors).toEqual([])
    expect(r.data.marketplaceGetOutgoingPayment).toBeNull()
  })
})
