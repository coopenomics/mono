/**
 * Приёмка имущества на участке (реестр marketplace.supply) снаружи: кто и
 * какую приёмку вправе открыть, одна активная приёмка на партию, порядок
 * подписей акта и цена приёмки на всём пути имущества — склад, выдача и
 * выплата поставщику.
 *
 * Набор ведёт свой заказ: оформление пайщицей, акцепт поставщиком, приёмка
 * оператором участка krg со скидкой, выдача по цене приёмки.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIRMAN,
  ROLES,
  amount,
  caseName,
  ensureShareFunds,
  gql,
  signDocument,
  tokenOf,
  waitFor,
} from '../core'
import { KRG, applyOpsOfProcess, getOrder, issueOrder, pickOffer, placeOrder } from './flow'
import { refusal } from './mkt-flows.helpers'

const ekaterina = ROLES.member()
const sidorov = ROLES.supplier()
const chairkrg = ROLES.branchChairman()
const chairodn = ROLES.foreignBranchChairman()

let memberToken = ''
let supplierToken = ''
let operatorToken = ''
let foreignToken = ''
let chairmanToken = ''

const QTY = 2

const RECEPTION_FIELDS = 'id status shipment_id braname offerer_account fact_quantity_per_order{ order_id fact_quantity fact_unit_price }'
const EXPRESS = `mutation($d:MarketplaceCreateExpressReceptionInput!){ marketplaceCreateExpressReception(data:$d){ apl_receptions{ ${RECEPTION_FIELDS} } } }`
const CREATE = `mutation($d:MarketplaceCreateAplReceptionInput!){ marketplaceCreateAplReception(data:$d){ apl_reception{ ${RECEPTION_FIELDS} } } }`
const PICKUP = `query($d:MarketplaceListSupplierPickupOrdersInput!){ marketplaceListSupplierPickupOrders(data:$d){ id status supplier_account } }`
const FEED = `query($d:MarketplaceListAplReceptionsByBranameInput!){ marketplaceListAplReceptionsByBraname(data:$d){ ${RECEPTION_FIELDS} } }`
const CHAIR_PAYLOADS = `query($d:MarketplaceAplReceptionByIdInput!){
  marketplaceAplReceptionChairmanSignablePayloads(data:$d){
    hash
    rawDocument{ full_title html hash meta binary }
    document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
  }
}`
const SIGN_CHAIR = `mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status } } }`

async function receptionsOfOrder(orderId: string): Promise<any[]> {
  const d = await gql<any>(operatorToken, FEED, { d: { braname: KRG } })
  return (d.marketplaceListAplReceptionsByBraname as any[]).filter(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
}

async function reception(id: string): Promise<any> {
  const d = await gql<any>(operatorToken, FEED, { d: { braname: KRG } })
  return (d.marketplaceListAplReceptionsByBraname as any[]).find(r => r.id === id)
}

describe('приёмка на участке: права, одна приёмка на партию, порядок подписей, цена приёмки', () => {
  let orderId = ''
  let orderHash = ''
  let price = 0
  let markdownPrice = 0

  beforeAll(async () => {
    memberToken = await tokenOf(ekaterina)
    supplierToken = await tokenOf(sidorov)
    operatorToken = await tokenOf(chairkrg)
    foreignToken = await tokenOf(chairodn)
    chairmanToken = await tokenOf(CHAIRMAN)

    const offer = await pickOffer(chairmanToken, sidorov.account, KRG, 'Мёд цветочный')
    price = amount(offer.price_per_unit)
    markdownPrice = Math.floor(price * 75) / 100
    await ensureShareFunds(ekaterina.account, QTY * price * 2, memberToken)
    const placed = await placeOrder({ who: ekaterina, offerId: offer.id, quantity: QTY })
    orderId = placed.orderId
    orderHash = placed.orderHash
    await gql(supplierToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', { i: { order_ids: [orderId] } })
    expect((await getOrder(memberToken, orderId)).status, 'заказ акцептован поставщиком').toBe('ACCEPTED')
  }, 600_000)

  it(caseName('mkt.supply.side.03', 'оператор чужого участка приёмку не открывает и акт не видит'), async () => {
    const express = await refusal(foreignToken, EXPRESS, { d: { braname: KRG, offerer_account: sidorov.account } })
    expect(express?.codeText, express?.message).toBe('MARKETPLACE_RECEPTION_NOT_TRUSTEE')
    const pickup = await refusal(foreignToken, PICKUP, { d: { braname: KRG, offerer_account: sidorov.account } })
    expect(pickup?.codeText, pickup?.message).toBe('MARKETPLACE_RECEPTION_SINGLE_FEED_NOT_TRUSTEE')
    const feed = await refusal(foreignToken, FEED, { d: { braname: KRG } })
    expect(feed?.codeText, feed?.message).toBe('MARKETPLACE_RECEPTION_FEED_NOT_TRUSTEE')

    expect((await getOrder(memberToken, orderId)).status, 'статус заказа не изменился').toBe('ACCEPTED')
    expect(await receptionsOfOrder(orderId), 'приёмка не открыта').toEqual([])
  })

  it(caseName('mkt.supply.side.04', 'код передачи пайщика-не-поставщика: приёмка не открывается, состав не показывается'), async () => {
    const own = await gql<any>(operatorToken, PICKUP, { d: { braname: KRG, offerer_account: sidorov.account } })
    expect((own.marketplaceListSupplierPickupOrders as any[]).some(o => o.id === orderId), 'по коду поставщика состав виден').toBe(true)

    const foreign = await gql<any>(operatorToken, PICKUP, { d: { braname: KRG, offerer_account: ekaterina.account } })
    expect(foreign.marketplaceListSupplierPickupOrders, 'по коду не-поставщика состава нет').toEqual([])
    const express = await refusal(operatorToken, EXPRESS, { d: { braname: KRG, offerer_account: ekaterina.account } })
    expect(express?.codeText, express?.message).toBe('MARKETPLACE_SUPPLIER_NO_ORDERS_AWAITING_PICKUP')
    expect(await receptionsOfOrder(orderId)).toEqual([])
  })

  let shipmentId = ''

  it(caseName('mkt.supply.side.02', 'принять больше заказанного нельзя — акт не создаётся'), async () => {
    const over = [{ order_id: orderId, fact_quantity: QTY + 1, fact_unit_price: price.toFixed(4) }]
    const express = await refusal(operatorToken, EXPRESS, { d: { braname: KRG, offerer_account: sidorov.account, fact_quantity_per_order: over } })
    expect(express?.codeText, express?.message).toBe('MARKETPLACE_ORDER_FACT_EXCEEDS_ORDERED')
    expect(await receptionsOfOrder(orderId), 'акт не создан').toEqual([])

    // Партия самовывоза заводится до проверки факта; по ней приёмка
    // открывается формированием акта — там тот же потолок.
    const after = await gql<any>(memberToken, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id status shipment_id } }', { i: { order_id: orderId } })
    console.info(`[mkt.supply.side.02] после отказа экспресс-приёмки: заказ ${after.marketplaceGetOrder.status}, партия ${after.marketplaceGetOrder.shipment_id ?? '—'}`)
    shipmentId = after.marketplaceGetOrder.shipment_id ?? ''
    if (shipmentId) {
      const create = await refusal(operatorToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: over } })
      expect(create?.codeText, create?.message).toBe('MARKETPLACE_ORDER_FACT_EXCEEDS_ORDERED')
      expect(await receptionsOfOrder(orderId), 'акт не создан').toEqual([])
    }
  })

  let receptionId = ''

  it(caseName('mkt.supply.side.05', 'повторное формирование акта по партии с открытой приёмкой — отказ «уже сформирована»'), async () => {
    const fact = [{ order_id: orderId, fact_quantity: QTY, fact_unit_price: price.toFixed(4) }]
    let first: any
    if (shipmentId) {
      first = (await gql<any>(operatorToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: fact } })).marketplaceCreateAplReception.apl_reception
    }
    else {
      const ex = await gql<any>(operatorToken, EXPRESS, { d: { braname: KRG, offerer_account: sidorov.account, fact_quantity_per_order: fact } })
      first = (ex.marketplaceCreateExpressReception.apl_receptions as any[]).find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === orderId))
      shipmentId = first.shipment_id
    }
    expect(first.status).toBe('PENDING_SUPPLIER_SIGN')
    receptionId = first.id

    const again = await refusal(operatorToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: fact } })
    expect(again?.codeText, again?.message).toBe('MARKETPLACE_RECEPTION_ALREADY_CREATED')
    const open = (await receptionsOfOrder(orderId)).filter(r => r.status !== 'CANCELLED')
    expect(open.map(r => r.id), 'второй акт не создан').toEqual([receptionId])
  })

  it(caseName('mkt.supply.side.13', 'после отмены черновика партия свободна — акт формируется заново'), async () => {
    const c = await gql<any>(operatorToken, 'mutation($d:MarketplaceAplReceptionByIdInput!){ marketplaceCancelAplReception(data:$d){ apl_reception{ id status } } }', { d: { apl_reception_id: receptionId } })
    expect(c.marketplaceCancelAplReception.apl_reception.status).toBe('CANCELLED')

    // Привезли хуже заказанного — оператор принимает со скидкой.
    const fact = [{ order_id: orderId, fact_quantity: QTY, fact_unit_price: markdownPrice.toFixed(4) }]
    const d = await gql<any>(operatorToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: fact } })
    const again = d.marketplaceCreateAplReception.apl_reception
    expect(again.status).toBe('PENDING_SUPPLIER_SIGN')
    expect(again.id).not.toBe(receptionId)
    expect(again.shipment_id).toBe(shipmentId)
    receptionId = again.id
    expect((await reception(receptionId)).status).toBe('PENDING_SUPPLIER_SIGN')
  })

  it(caseName('mkt.supply.side.06', 'закрывающая подпись председателя раньше подписи поставщика — отказ'), async () => {
    const preview = await refusal(operatorToken, CHAIR_PAYLOADS, { d: { apl_reception_id: receptionId } })
    expect(preview?.codeText, preview?.message).toBe('MARKETPLACE_RECEPTION_CHAIRMAN_SIGN_BEFORE_SUPPLIER')

    // Подпись председателя поверх акта, который поставщик ещё не подписывал.
    const sp = await gql<any>(supplierToken, `query($d:MarketplaceAplReceptionByIdInput!){
      marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary }
    }`, { d: { apl_reception_id: receptionId } })
    const docs = sp.marketplaceAplReceptionSupplierSignablePayloads as any[]
    const early: any[] = []
    for (const p of docs) early.push(await signDocument(chairkrg.wif, p, chairkrg.account, 1))
    const sign = await refusal(operatorToken, SIGN_CHAIR, { d: { apl_reception_id: receptionId, signed_documents: early } })
    expect(sign?.codeText, sign?.message).toBe('MARKETPLACE_RECEPTION_CHAIRMAN_SIGN_WRONG_STATUS')
    expect((await reception(receptionId)).status, 'акт ждёт подписи поставщика').toBe('PENDING_SUPPLIER_SIGN')

    // Поставщик подписывает — теперь очередь председателя.
    const signed: any[] = []
    for (const p of docs) signed.push(await signDocument(sidorov.wif, p, sidorov.account, 1))
    const s = await gql<any>(supplierToken, 'mutation($d:MarketplaceSignAplReceptionInput!){ marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status } } }', { d: { apl_reception_id: receptionId, signed_documents: signed } })
    expect(s.marketplaceSignAplReceptionAsSupplier.apl_reception.status).toBe('PENDING_CHAIRMAN_RECEPTION_SIGN')
  })

  it(caseName('mkt.supply.side.03', 'председатель чужого участка не закрывает акт — статус партии не меняется'), async () => {
    const preview = await refusal(foreignToken, CHAIR_PAYLOADS, { d: { apl_reception_id: receptionId } })
    expect(preview?.codeText, preview?.message).toBe('MARKETPLACE_RECEPTION_PREVIEW_NOT_TRUSTEE')

    // Даже с агрегатом акта на руках подпись чужого председателя не проходит.
    const cp = await gql<any>(operatorToken, CHAIR_PAYLOADS, { d: { apl_reception_id: receptionId } })
    const foreignSigned: any[] = []
    for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) foreignSigned.push(await signDocument(chairodn.wif, p.rawDocument, chairodn.account, 2, [p.document]))
    const sign = await refusal(foreignToken, SIGN_CHAIR, { d: { apl_reception_id: receptionId, signed_documents: foreignSigned } })
    expect(sign, 'закрывающая подпись чужого председателя отклонена').not.toBeNull()
    expect(['403', 'KIT_INSUFFICIENT_RIGHTS', 'MARKETPLACE_RECEPTION_NOT_TRUSTEE', 'MARKETPLACE_RECEPTION_CHAIRMAN_SIGN_CHAIN_FAILED'], sign?.message).toContain(sign?.codeText)
    expect((await reception(receptionId)).status, 'акт по-прежнему ждёт председателя своего участка').toBe('PENDING_CHAIRMAN_RECEPTION_SIGN')
    expect((await getOrder(memberToken, orderId)).status, 'заказ не принят кооперативом').not.toBe('ACCEPTED_TO_COOP')
  })

  it(caseName('mkt.supply.side.35', 'выплата поставщику — по принятому количеству и цене из акта'), async () => {
    const cp = await gql<any>(operatorToken, CHAIR_PAYLOADS, { d: { apl_reception_id: receptionId } })
    const signed: any[] = []
    for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) signed.push(await signDocument(chairkrg.wif, p.rawDocument, chairkrg.account, 2, [p.document]))
    const r = await gql<any>(operatorToken, SIGN_CHAIR, { d: { apl_reception_id: receptionId, signed_documents: signed } })
    expect(r.marketplaceSignAplReceptionAsChairman.apl_reception.status).toBe('ACCEPTED_TO_COOP')

    const accepted = QTY * markdownPrice
    const order = await getOrder(memberToken, orderId)
    expect(amount(order.accepted_cost), 'принятая стоимость — по акту').toBeCloseTo(accepted, 4)

    const d = await gql<any>(supplierToken, 'query{ marketplaceListOutgoingPaymentsAsSupplier{ order_id amount withheld_amount status payee_account } }')
    const payout = (d.marketplaceListOutgoingPaymentsAsSupplier as any[]).find(p => p.order_id === orderId)
    expect(payout, 'выплата поставщику заведена при закрытии приёмки').toBeTruthy()
    expect(payout.payee_account).toBe(sidorov.account)
    // Признанный гарантийный долг поставщика удерживается из выплаты, поэтому
    // сверяется сумма перевода и удержания.
    expect(amount(payout.amount) + amount(payout.withheld_amount), `выплата по цене акта ${markdownPrice}, а не заказа ${price}`).toBeCloseTo(accepted, 4)
  })

  it(caseName('mkt.supply.side.10', 'уценка на приёмке: склад и выдача по цене приёмки, разница возвращается пайщице'), async () => {
    const inv = await gql<any>(operatorToken, `query($d:MarketplaceListInventoryInput){
      marketplaceListInventory(data:$d){ id order_id origin arrival_price }
    }`, { d: { order_id: orderId } })
    const items = (inv.marketplaceListInventory as any[]).filter(i => i.order_id === orderId)
    expect(items.length, 'имущество оприходовано на склад участка').toBeGreaterThan(0)
    for (const i of items) expect(amount(i.arrival_price), 'на склад — по цене приёмки').toBeCloseTo(markdownPrice, 4)
    const order = await getOrder(memberToken, orderId)
    const arrival = amount((await gql<any>(memberToken, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ warehouse_arrival_price } }', { i: { order_id: orderId } })).marketplaceGetOrder.warehouse_arrival_price)
    expect(arrival, 'заказ показывает цену прибытия — цену приёмки').toBeCloseTo(markdownPrice, 4)

    // Выдача открывается по цене прибытия со склада.
    await issueOrder({ operator: chairkrg, member: ekaterina, orderId, actualQuantity: QTY, actualUnitPrice: arrival })

    const ops = await waitFor(async () => {
      const rows = await applyOpsOfProcess(chairmanToken, orderHash)
      return rows.some(r => r.operationCode === 'o.mkt.consum') ? rows : null
    }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'выдача в нитке заказа' })
    const sum = (code: string) => ops.filter(r => r.operationCode === code).reduce((s, r) => s + amount(r.quantity), 0)
    expect(sum('o.mkt.purch'), 'приход на счёт 10 — по цене приёмки').toBeCloseTo(QTY * markdownPrice, 4)
    expect(sum('o.mkt.consum'), 'выбытие при выдаче — по той же цене').toBeCloseTo(QTY * markdownPrice, 4)
    expect(sum('o.mkt.unlock'), 'разница с ценой заказа возвращается пайщице как недостача').toBeCloseTo(amount(order.total_cost) - QTY * markdownPrice, 4)
  })
})
