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
import { CHAIRMAN, ROLES, caseName, chainMessage, ensureShareFunds, gql, gqlRaw, randomHash, tableRows, tokenOf, transact, waitFor } from '../core'
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

/** Выплаты в нужном состоянии, в которые входит хотя бы один заказ набора. */
async function payoutsWithOrders(status: string, exclude: string[] = []): Promise<any[]> {
  return (await payoutsOf()).filter(p => !exclude.includes(p.id) && p.status === status && p.order_ids.some((id: string) => orderIds.includes(id)))
}

/** Строка пакета в цепи по хэшу выплаты; стёрта — undefined. */
async function chainBatch(payment_hash: string): Promise<any | undefined> {
  return (await tableRows<any>('marketplace', COOP, 'payouts')).find(b => String(b.hash).toLowerCase() === payment_hash)
}

/** Отказ контракта на действие от имени кооператива; действие принято — пометка об этом. */
async function refusalOf(account: string, name: string, data: Record<string, unknown>): Promise<string> {
  try {
    await transact(COOP_SIGNER, [{ account, name, data: { coopname: COOP, ...data } }])
  }
  catch (e) {
    return chainMessage(e)
  }
  return 'действие принято'
}

/**
 * Сутки стенда — минута, обход идёт в начале каждой минуты. Действие, после
 * которого заказы должны попасть в один пакет следующих суток, набор делает в
 * первой половине минуты: до следующего обхода узел успевает его обработать.
 */
async function untilFirstHalfOfStandDay(): Promise<void> {
  await waitFor(async () => {
    const second = new Date().getSeconds()
    return second >= 5 && second <= 25 ? true : null
  }, { timeoutMs: 70_000, intervalMs: 1_000, label: 'первая половина суток стенда' })
}

describe.skipIf(!COMPRESSED)('выплата поставщику пакетом за сутки', () => {
  /** Первые выплаты с заказами набора: одна, если оба заказа приняты в одни сутки стенда, иначе две. */
  let firstPayouts: any[] = []
  /** Выплата следующих суток после отказа кассира: в неё входят оба заказа. */
  let merged: any

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

  it(caseName('mkt.payouts.happy.01', 'принятые заказы поставщика обход объединяет в выплату: один платёж кассиру на сумму принятого по заказам выплаты'), async () => {
    // Приёмка двух заказов длится дольше половины суток стенда, поэтому заказы
    // могут попасть в соседние сутки и в две выплаты. Каждый заказ входит ровно
    // в одну выплату; в выплату входят и заказы поставщика из соседних наборов.
    firstPayouts = await waitFor(async () => {
      const list = await payoutsWithOrders('PENDING')
      return orderIds.every(id => list.some(p => p.order_ids.includes(id))) ? list : null
    }, { timeoutMs: BATCH_WAIT_MS, intervalMs: 5_000, label: 'заказы набора включены в выплату поставщику' })

    for (const id of orderIds)
      expect(firstPayouts.filter(p => p.order_ids.includes(id)), `заказ ${id} — ровно в одной выплате`).toHaveLength(1)

    for (const payout of firstPayouts) {
      expect(payout.payee_account).toBe(supplier.account)
      expect(payout.orders_count).toBe(payout.order_ids.length)
      expect(payout.core_payment_id, 'платёж в реестре кассира заведён').toBeTruthy()

      const d = await gql<any>(board, DETAIL, { id: payout.id })
      const detail = d.marketplaceGetOutgoingPayment
      expect(detail.orders.map((o: any) => o.id).sort()).toEqual([...payout.order_ids].sort())
      // Сумму считает контракт: перевод и удержание вместе — принятые стоимости заказов выплаты.
      const acceptedTotal = (detail.orders as any[]).reduce((sum, o) => sum + amount(o.accepted_cost), 0)
      expect(amount(payout.amount) + amount(payout.withheld_amount), 'сумма выплаты — принятые стоимости её заказов').toBeCloseTo(acceptedTotal, 4)
      for (const id of orderIds.filter(x => payout.order_ids.includes(x)))
        expect(amount(detail.orders.find((o: any) => o.id === id).accepted_cost), 'принятая стоимость заказа набора').toBeCloseTo(accepted.get(id) ?? 0, 4)
      expect(detail.core_payment.quantity, 'кассир переводит ровно сумму выплаты').toBeCloseTo(amount(payout.amount), 4)

      // В цепи — одна строка пакета и один исходящий платёж gateway на всю выплату.
      const batch = await chainBatch(payout.payment_hash)
      expect(batch, 'строка пакета в цепи').toBeTruthy()
      expect(batch.status).toBe('sent')
      expect(Number(batch.orders)).toBe(payout.order_ids.length)
      expect(amount(batch.amount)).toBeCloseTo(amount(payout.amount), 4)
      const outcomes = (await tableRows<any>('gateway', COOP, 'outcomes')).filter(o => String(o.outcome_hash).toLowerCase() === payout.payment_hash)
      expect(outcomes, 'один исходящий платёж gateway на выплату').toHaveLength(1)
      expect(amount(outcomes[0].quantity)).toBeCloseTo(amount(payout.amount), 4)
    }
  }, BATCH_WAIT_MS + 120_000)

  it(caseName('mkt.payouts.side.11', 'пакет ждёт кассира — контракт отклоняет действия пакета не в своём состоянии, с кодом'), async () => {
    const payout = firstPayouts[0]
    const before = await chainBatch(payout.payment_hash)

    // Заказы пакета в цепи помечены его хэшем и ждут выплаты.
    const chainOrders = (await tableRows<any>('marketplace', COOP, 'orders'))
      .filter(o => String(o.payout_hash ?? '').toLowerCase() === payout.payment_hash)
    expect(chainOrders).toHaveLength(payout.order_ids.length)
    expect(chainOrders.every(o => o.payout_status === 'pending')).toBe(true)
    const order_hash = chainOrders[0].hash

    expect(await refusalOf('marketplace', 'closepayout', { order_hash }), 'закрытие заказа до подтверждения кассира').toContain('MARKETPLACE_PAYOUT_NOT_PAID')
    expect(await refusalOf('marketplace', 'releasepay', { order_hash }), 'возврат заказа без отказа кассира').toContain('MARKETPLACE_PAYOUT_NOT_DECLINED')
    expect(await refusalOf('marketplace', 'sendpayout', { payout_hash: payout.payment_hash }), 'повторная отправка пакета').toContain('MARKETPLACE_PAYOUT_NOT_OPEN')
    expect(await refusalOf('marketplace', 'sendpayout', { payout_hash: randomHash() }), 'отправка пакета, которого нет').toContain('MARKETPLACE_PAYOUT_NOT_FOUND')
    expect(await refusalOf('marketplace', 'addpayout', { payout_hash: payout.payment_hash, order_hash }), 'повторное включение заказа').toContain('MARKETPLACE_PAYOUT_ALREADY_STARTED')
    expect(await refusalOf('marketplace', 'addpayout', { payout_hash: randomHash(), order_hash }), 'включение заказа во второй пакет').toContain('MARKETPLACE_PAYOUT_ALREADY_STARTED')

    // Отказы ничего не изменили: пакет в прежнем состоянии.
    expect(await chainBatch(payout.payment_hash)).toMatchObject({ status: 'sent', orders: before.orders, amount: before.amount })
  }, 120_000)

  it(caseName('mkt.payouts.side.12', 'решение кассира по платежу, которого в gateway нет, — отказ с кодом'), async () => {
    const outcome_hash = randomHash()
    expect(await refusalOf('gateway', 'outcomplete', { outcome_hash }), 'подтверждение').toContain('GATEWAY_OUTCOME_NOT_FOUND')
    expect(await refusalOf('gateway', 'outdecline', { outcome_hash, reason: 'нет такого платежа' }), 'отказ').toContain('GATEWAY_OUTCOME_NOT_FOUND')
  }, 60_000)

  it(caseName('mkt.payouts.side.07', 'кассир отказал — заказы возвращаются и попадают в одну выплату следующих суток'), async () => {
    // Отказ по всем первым выплатам — одной транзакцией в первой половине суток
    // стенда: заказы возвращаются в одни сутки и попадают в один пакет следующих.
    await untilFirstHalfOfStandDay()
    await transact(COOP_SIGNER, firstPayouts.map(p => ({
      account: 'gateway',
      name: 'outdecline',
      data: { coopname: COOP, outcome_hash: p.payment_hash, reason: 'Неверные реквизиты' },
    })))
    const declinedIds = firstPayouts.map(p => p.id)
    const declined: any[] = await waitFor(async () => {
      const list = (await payoutsOf()).filter(p => declinedIds.includes(p.id))
      return list.every(p => p.status === 'DECLINED') ? list : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'выплаты отклонены' })
    for (const p of declined)
      expect(p.decline_reason).toBe('Неверные реквизиты')

    // Заказы возвращены, строки отклонённых пакетов стёрты: история в памяти контракта не копится.
    await waitFor(async () => {
      for (const p of firstPayouts) {
        if (await chainBatch(p.payment_hash))
          return null
      }
      return true
    }, { timeoutMs: 90_000, intervalMs: 3_000, label: 'строки отклонённых пакетов стёрты из цепи' })

    merged = await waitFor(async () => {
      const list = await payoutsWithOrders('PENDING', declinedIds)
      return list.find(p => orderIds.every(id => p.order_ids.includes(id))) ?? null
    }, { timeoutMs: BATCH_WAIT_MS, intervalMs: 5_000, label: 'оба заказа — в одной выплате следующих суток' })
    expect(firstPayouts.map(p => p.payment_hash)).not.toContain(merged.payment_hash)
    expect(await payoutsWithOrders('PENDING', declinedIds), 'заказы набора — в одной выплате').toHaveLength(1)
    // Удержанный долг второй раз не удерживается: сумма новой выплаты — снова принятые стоимости её заказов.
    const d = await gql<any>(board, DETAIL, { id: merged.id })
    const acceptedTotal = (d.marketplaceGetOutgoingPayment.orders as any[]).reduce((sum, o) => sum + amount(o.accepted_cost), 0)
    expect(amount(merged.amount) + amount(merged.withheld_amount)).toBeCloseTo(acceptedTotal, 4)
  }, BATCH_WAIT_MS + 300_000)

  it(caseName('mkt.payouts.happy.02', 'кассир подтвердил перевод — выплата оплачена, заказы больше не ждут выплаты'), async () => {
    await cashierPaid(merged.core_payment_id)
    const paid = await waitFor(async () => {
      const p = (await payoutsOf()).find(x => x.id === merged.id)
      return p?.status === 'COMPLETED' ? p : null
    }, { timeoutMs: 90_000, intervalMs: 3_000, label: 'выплата подтверждена кассиром' })
    expect(paid.status).toBe('COMPLETED')

    // Заказы закрыты (Дт 76 / Кт 51 на заказ), строка оплаченного пакета стёрта из цепи.
    await waitFor(async () => ((await chainBatch(merged.payment_hash)) ? null : true),
      { timeoutMs: 90_000, intervalMs: 3_000, label: 'строка оплаченного пакета стёрта из цепи' })
    const stillPending = (await tableRows<any>('marketplace', COOP, 'orders'))
      .filter(o => String(o.payout_hash ?? '').toLowerCase() === merged.payment_hash && o.payout_status === 'pending')
    expect(stillPending, 'заказы пакета больше не ждут выплаты').toEqual([])
    expect(await refusalOf('gateway', 'outcomplete', { outcome_hash: merged.payment_hash }), 'повторное подтверждение оплаченного платежа').toContain('GATEWAY_OUTCOME_NOT_FOUND')

    // Следующие сутки новой выплаты с этими заказами не дают: обязательство закрыто.
    // timing: schedule — проверка отсутствия: ждём две сутки стенда и смотрим, что обход не завёл новую выплату
    await new Promise(r => setTimeout(r, 2 * 60_000))
    const again = (await payoutsOf()).filter(p => p.id !== merged.id && p.status !== 'DECLINED' && p.order_ids.some((id: string) => orderIds.includes(id)))
    expect(again).toEqual([])
  }, 420_000)
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
