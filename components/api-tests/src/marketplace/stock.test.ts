/**
 * Обезличенный остаток кооператива снаружи (реестр marketplace.stock):
 * публикация остатка в каталог, заказ из остатка у стойки, уценка при выдаче
 * и гарантийный возврат имущества кооперативу.
 *
 * Остаток тест заводит сам тем путём, каким он появляется в жизни: заказчица
 * заказала 4 кг, на склад приняли 4 кг, выдали 1 кг — 3 кг остались
 * кооперативу. Дальше председатель участка публикует остаток с уценкой,
 * второй пайщик получает его докладкой у стойки и возвращает по гарантии.
 *
 * Шаги идут по порядку и опираются на состояние предыдущих.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, amount, caseName, ensureShareFunds, gqlError, gqlRaw, tokenOf, waitFor } from '../core'
import { ACC, KRG, acceptToCoop, historyOfProcess, issueOrder, pickOffer, placeOrder } from './flow'
import {
  PUBLISH_STOCK,
  STOCK_ISSUANCE_PAYLOADS,
  completeIssuance,
  createPackagedOffer,
  getOffer,
  inventoryOfOrder,
  listStock,
  orderFromStock,
  placePackagedOrder,
  returnAtVisit,
} from './stock.helpers'

const PRODUCT = 'Мёд цветочный'
const ORDERED = 4
const ISSUED = 1
const STOCK_QTY = ORDERED - ISSUED
const MARKDOWN_PRICE = 500
const WARRANTY_DAYS = 14
const TOPUP_QTY = 1

const near = (a: number, b: number) => Math.abs(a - b) < 0.005

describe('Стол заказов: остаток кооператива', () => {
  const member = ROLES.member()
  const buyer = ROLES.otherMember()
  const supplier = ROLES.supplier()
  const operator = ROLES.branchChairman()

  let operatorToken = ''
  let chairmanToken = ''
  let supplierOfferId = ''
  let arrivalPrice = 0
  let originOrderId = ''
  let stockRows: any[] = []
  let coopOfferId = ''
  let stockOrder = { orderId: '', orderHash: '' }

  beforeAll(async () => {
    operatorToken = await tokenOf(operator)
    chairmanToken = await tokenOf(CHAIRMAN)
    const memberToken = await tokenOf(member)

    const offer = await pickOffer(supplier.account, KRG, PRODUCT)
    supplierOfferId = offer.id
    arrivalPrice = amount(offer.price_per_unit)
    await ensureShareFunds(member.account, ORDERED * arrivalPrice * 2, memberToken)

    const placed = await placeOrder({ who: member, offerId: offer.id, quantity: ORDERED })
    originOrderId = placed.orderId
    await acceptToCoop({ supplier, operator, orderId: originOrderId, factQuantity: ORDERED, factUnitPrice: arrivalPrice })
    // Недовыдача: невостребованное уходит в остаток кооператива.
    await issueOrder({ operator, member, orderId: originOrderId, actualQuantity: ISSUED, actualUnitPrice: arrivalPrice })

    stockRows = (await listStock(operatorToken)).filter(r => r.order_id === originOrderId)
    const total = stockRows.reduce((s, r) => s + Number(r.quantity_per_label), 0)
    expect(near(total, STOCK_QTY), `в остатке ${STOCK_QTY} кг после недовыдачи, а не ${total}`).toBe(true)
    expect(stockRows.every(r => r.ownership === 'COOP' && r.published_offer_id === null)).toBe(true)
  }, 900_000)

  it(caseName('mkt.stock.side.04', 'остаток дороже цены прибытия не публикуется'), async () => {
    const err = await gqlError(operatorToken, PUBLISH_STOCK, {
      d: { inventory_ids: stockRows.map(r => r.id), price_per_unit: (arrivalPrice + 100).toFixed(4), warranty_days: WARRANTY_DAYS },
    })
    expect(err?.code).toBe('MARKETPLACE_STOCK_PUBLISH_PRICE_ABOVE_ARRIVAL')
    const after = (await listStock(operatorToken)).filter(r => r.order_id === originOrderId)
    expect(after.every(r => r.published_offer_id === null), 'позиции остались неопубликованными').toBe(true)
  })

  it(caseName('mkt.stock.side.05', 'адресная позиция под заказ пайщика и несуществующая позиция не публикуются'), async () => {
    const addressed = (await inventoryOfOrder(operatorToken, originOrderId)).find(r => r.ownership === 'ORDER')
    expect(addressed, 'выданная заказчице позиция числится за её заказом').toBeTruthy()
    const errAddressed = await gqlError(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: [addressed.id] } })
    expect(errAddressed?.code).toBe('MARKETPLACE_STOCK_ITEM_IS_ADDRESSED')

    const errMissing = await gqlError(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: [crypto.randomUUID()] } })
    expect(errMissing?.code).toBe('MARKETPLACE_STOCK_ITEMS_NOT_FOUND')

    const after = (await listStock(operatorToken)).filter(r => r.order_id === originOrderId)
    expect(after.every(r => r.published_offer_id === null), 'предложение кооператива не создано').toBe(true)
  })

  it(caseName('mkt.stock.side.05', 'уже опубликованная позиция повторно не публикуется'), async () => {
    const published = await gqlError(operatorToken, PUBLISH_STOCK, {
      d: { inventory_ids: stockRows.map(r => r.id), price_per_unit: MARKDOWN_PRICE.toFixed(4), warranty_days: WARRANTY_DAYS },
    })
    expect(published, 'уценённая публикация проходит').toBeNull()
    const rows = (await listStock(operatorToken)).filter(r => r.order_id === originOrderId)
    coopOfferId = rows[0]?.published_offer_id ?? ''
    expect(coopOfferId).toBeTruthy()
    const coopOffer = await getOffer(operatorToken, coopOfferId)
    expect(coopOffer.stock_braname).toBe(KRG)
    expect(near(amount(coopOffer.price_per_unit), MARKDOWN_PRICE)).toBe(true)
    expect(coopOffer.warranty_days).toBe(WARRANTY_DAYS)

    const err = await gqlError(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: rows.map(r => r.id) } })
    expect(err?.code).toBe('MARKETPLACE_STOCK_PARTIALLY_PUBLISHED')
    const again = await getOffer(operatorToken, coopOfferId)
    expect(near(again.quantity_available, coopOffer.quantity_available), 'остаток предложения не удвоился').toBe(true)
  })

  it(caseName('mkt.stock.side.03', 'заказ остатка сверх свободного отклоняется, счётчики предложения не двигаются'), async () => {
    const before = await getOffer(operatorToken, coopOfferId)
    const err = await gqlError(operatorToken, STOCK_ISSUANCE_PAYLOADS, {
      d: { braname: KRG, member_account: buyer.account, items: [{ offer_id: coopOfferId, quantity: STOCK_QTY + 5 }] },
    })
    expect(err?.code).toBe('MARKETPLACE_STOCK_PROPOSAL_INSUFFICIENT_STOCK')

    const errProposal = await gqlError(operatorToken, `mutation($d:MarketplaceCreateStockProposalInput!){ marketplaceCreateStockProposal(data:$d){ id } }`, {
      d: { braname: KRG, member_account: buyer.account, items: [{ offer_id: coopOfferId, quantity: STOCK_QTY + 5, order_hash: crypto.randomBytes(32).toString('hex') }] },
    })
    expect(errProposal?.code).toBe('MARKETPLACE_STOCK_PROPOSAL_INSUFFICIENT_STOCK')

    const after = await getOffer(operatorToken, coopOfferId)
    expect(near(after.quantity_available, before.quantity_available)).toBe(true)
    expect(near(after.quantity_blocked, before.quantity_blocked)).toBe(true)
  })

  it(caseName('mkt.stock.side.06', 'предложение поставщика заказом из остатка не оформляется'), async () => {
    const err = await gqlError(operatorToken, STOCK_ISSUANCE_PAYLOADS, {
      d: { braname: KRG, member_account: buyer.account, items: [{ offer_id: supplierOfferId, quantity: 1 }] },
    })
    expect(err?.code).toBe('MARKETPLACE_STOCK_PROPOSAL_WRONG_KU_STOCK')
  })

  it(caseName('mkt.stock.side.05', 'позиция, зарезервированная под заказ из остатка, не публикуется'), async () => {
    const buyerToken = await tokenOf(buyer)
    await ensureShareFunds(buyer.account, TOPUP_QTY * MARKDOWN_PRICE * 2, buyerToken)
    stockOrder = await orderFromStock({ operator, member: buyer, offerId: coopOfferId, quantity: TOPUP_QTY })

    const reserved = (await inventoryOfOrder(operatorToken, originOrderId)).find(r => r.reserved_order_id === stockOrder.orderId)
    expect(reserved, 'заказ из остатка зарезервировал позицию склада').toBeTruthy()
    const err = await gqlError(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: [reserved.id] } })
    expect(err?.code).toBe('MARKETPLACE_STOCK_ITEM_RESERVED')
  })

  it(caseName('mkt.stock.side.02', 'выдача остатка с уценкой: разница выбывает прочим расходом вместе со списанием себестоимости'), async () => {
    expect(stockOrder.orderId, 'заказ из остатка оформлен предыдущим шагом').toBeTruthy()
    await completeIssuance({ operator, member: buyer, orderId: stockOrder.orderId })

    const markdown = (arrivalPrice - MARKDOWN_PRICE) * TOPUP_QTY
    // Уценку контроллер отправляет в цепь после закрытия выдачи; журнал
    // ledger2 доходит до API через индексер.
    const rows = await waitFor(async () => {
      const h = await historyOfProcess(chairmanToken, stockOrder.orderHash)
      return h.some(r => r.action === 'apply' && r.operationCode === 'o.mkt.loss') ? h : null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: `o.mkt.loss по заказу ${stockOrder.orderId}` })

    const sumApply = (code: string) => rows.filter(r => r.action === 'apply' && r.operationCode === code).reduce((s, r) => s + amount(r.quantity), 0)
    expect(near(sumApply('o.mkt.loss'), markdown), `уценка ${markdown}`).toBe(true)
    expect(near(sumApply('o.mkt.consum') + sumApply('o.mkt.loss'), arrivalPrice * TOPUP_QTY), 'со склада выбыла полная стоимость прибытия').toBe(true)

    const loss = rows.filter(r => r.operationCode === 'o.mkt.loss')
    expect(loss.some(r => r.action === 'debit' && r.accountId === ACC.OTHER && near(amount(r.quantity), markdown)), 'Дт 91').toBe(true)
    expect(loss.some(r => r.action === 'credit' && r.accountId === ACC.MATERIALS && near(amount(r.quantity), markdown)), 'Кт 10').toBe(true)
  })

  it(caseName('mkt.stock.side.01', 'возврат по заказу из остатка находит партию через резерв и возвращает имущество кооперативу'), async () => {
    expect(stockOrder.orderId, 'заказ из остатка выдан предыдущим шагом').toBeTruthy()
    const shipmentId = stockRows[0].shipment_id
    expect(shipmentId).toBeTruthy()

    const { claimId } = await returnAtVisit({ operator, member: buyer, orderId: stockOrder.orderId, quantity: TOPUP_QTY })

    // Решение совета принимает робот, имущество зачисляется по его решению.
    const restocked = await waitFor(async () => {
      const row = (await listStock(operatorToken)).find(r => r.return_claim_id === claimId)
      return row ?? null
    }, { timeoutMs: 180_000, intervalMs: 2_000, label: `возврат ${claimId} в остатке участка` })

    expect(restocked.ownership).toBe('COOP')
    expect(restocked.origin).toBe('WARRANTY_RETURN')
    expect(restocked.shipment_id, 'имущество легло в партию исходной поставки').toBe(shipmentId)
    expect(near(Number(restocked.quantity_per_label), TOPUP_QTY)).toBe(true)
    expect(restocked.braname).toBe(KRG)
  })
})

describe('Стол заказов: остаток кооператива упаковками', () => {
  const member = ROLES.member()
  const buyer = ROLES.otherMember()
  const supplier = ROLES.supplier()
  const operator = ROLES.branchChairman()

  const BOX = 10
  const BOX_PRICE = 120
  const BOXES_ORDERED = 3
  const BOXES_ISSUED = 1
  const BOXES_LEFT = BOXES_ORDERED - BOXES_ISSUED

  let operatorToken = ''
  let offerId = ''
  let packageId = ''

  /** Недовыдача упаковками: заказано 3 коробки, выдана 1 — 2 коробки уходят кооперативу. */
  async function stockFromShortIssue(): Promise<any[]> {
    const { orderId } = await placePackagedOrder({ who: member, offerId, packageId, packages: BOXES_ORDERED })
    await acceptToCoop({ supplier, operator, orderId, factQuantity: BOXES_ORDERED * BOX, factUnitPrice: BOX_PRICE })
    await issueOrder({ operator, member, orderId, actualQuantity: BOXES_ISSUED * BOX, actualUnitPrice: BOX_PRICE })
    return (await listStock(operatorToken)).filter(r => r.order_id === orderId)
  }

  function coopPackage(offer: any): any {
    return (offer.packages as any[]).find(p => near(Number(p.size), BOX))
  }

  async function coopOffer(id: string): Promise<any> {
    const d = await gqlRaw(operatorToken, 'query($id:String!){ marketplaceGetOffer(id:$id){ id stock_braname packages{ id size quantity_available quantity_blocked quantity_consumed } } }', { id })
    return d.data.marketplaceGetOffer
  }

  beforeAll(async () => {
    operatorToken = await tokenOf(operator)
    const created = await createPackagedOffer({
      supplier,
      chairman: CHAIRMAN,
      productName: `Яйца в коробках (внешний тест ${crypto.randomBytes(3).toString('hex')})`,
      packageSize: BOX,
      packagePrice: BOX_PRICE,
    })
    offerId = created.offerId
    packageId = created.packageId
    await ensureShareFunds(member.account, BOXES_ORDERED * BOX_PRICE * 4, await tokenOf(member))
    await ensureShareFunds(buyer.account, BOX_PRICE * 2, await tokenOf(buyer))
  }, 300_000)

  it(caseName('mkt.stock.side.09', 'остаток упаковками: у предложения кооператива свои счётчики коробок, повторная публикация прибавляет, не сбрасывая заблокированное'), async () => {
    const first = await stockFromShortIssue()
    expect(first.length).toBeGreaterThan(0)
    expect(near(first.reduce((s, r) => s + Number(r.quantity_per_label), 0), BOXES_LEFT * BOX)).toBe(true)

    const pub = await gqlRaw(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: first.map(r => r.id) } })
    expect(pub.errors).toEqual([])
    const coopOfferId = pub.data.marketplacePublishStock[0].id as string
    const pkg = coopPackage(await coopOffer(coopOfferId))
    expect(pkg, 'у предложения остатка есть упаковка по 10 штук').toBeTruthy()
    // Счётчики поставщика на витрину кооператива не переезжают: только его коробки.
    expect(pkg.quantity_available).toBe(BOXES_LEFT)
    expect(pkg.quantity_blocked).toBe(0)
    expect(pkg.quantity_consumed).toBe(0)

    // Одна коробка уходит в заказ из остатка — она заблокирована.
    const topup = await orderFromStock({ operator, member: buyer, offerId: coopOfferId, quantity: 1, packageId: pkg.id })
    const blocked = coopPackage(await coopOffer(coopOfferId))
    expect(blocked.quantity_available).toBe(BOXES_LEFT - 1)
    expect(blocked.quantity_blocked).toBe(1)

    // Вторая недовыдача того же товара и повторная публикация.
    const second = await stockFromShortIssue()
    const pub2 = await gqlRaw(operatorToken, PUBLISH_STOCK, { d: { inventory_ids: second.map(r => r.id) } })
    expect(pub2.errors).toEqual([])
    expect(pub2.data.marketplacePublishStock[0].id, 'остаток того же товара пополняет прежнее предложение').toBe(coopOfferId)
    const after = coopPackage(await coopOffer(coopOfferId))
    expect(after.quantity_available).toBe(BOXES_LEFT - 1 + BOXES_LEFT)
    expect(after.quantity_blocked, 'заблокированное повторной публикацией не сброшено').toBe(1)

    // Заказ из остатка доводится до выдачи: стенд остаётся без висящих саг.
    await completeIssuance({ operator, member: buyer, orderId: topup.orderId })
  })
})
