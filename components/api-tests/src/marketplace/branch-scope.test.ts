/**
 * Оператор распоряжается только своим участком (реестр marketplace.branch-scope).
 *
 * Право оператора в таблице ролей Стола заказов говорит «председатель или
 * доверенный какого-то участка». Чей это склад, чья партия и чьё заявление —
 * сверяет резолвер. Набор берёт председателя участка odn и проверяет, что на
 * участке krg он не открывает приёмку, не трогает склад, не публикует остаток,
 * не отменяет заказ со склада, не отзывает докладку и не решает по возврату.
 * После каждого отказа то же действие проходит у председателя krg либо
 * состояние остаётся прежним.
 */
import crypto from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, amount, caseName, ensureShareFunds, gql, signDocument, tokenOf } from '../core'
import { KRG, acceptToCoop, ensureIdentityVerified, getOrder, pickOffer, placeOrder } from './flow'
import { refusal } from './mkt-flows.helpers'
import { inventoryOfOrder } from './stock.helpers'

const PRODUCT = 'Мёд цветочный'
const NOT_TRUSTEE = 'KIT_RIGHT_SCOPE_OWN_KU'

const member = ROLES.member()
const supplier = ROLES.supplier()
const operator = ROLES.branchChairman()
const foreign = ROLES.foreignBranchChairman()

let memberToken = ''
let supplierToken = ''
let operatorToken = ''
let foreignToken = ''

const RECEPTION_FIELDS = 'id status shipment_id fact_quantity_per_order{ order_id fact_quantity fact_unit_price }'
const EXPRESS = `mutation($d:MarketplaceCreateExpressReceptionInput!){ marketplaceCreateExpressReception(data:$d){ apl_receptions{ ${RECEPTION_FIELDS} } } }`
const CREATE = `mutation($d:MarketplaceCreateAplReceptionInput!){ marketplaceCreateAplReception(data:$d){ apl_reception{ ${RECEPTION_FIELDS} } } }`
const CANCEL_RECEPTION = 'mutation($d:MarketplaceAplReceptionByIdInput!){ marketplaceCancelAplReception(data:$d){ apl_reception{ id status } } }'
const FEED = `query($d:MarketplaceListAplReceptionsByBranameInput!){ marketplaceListAplReceptionsByBraname(data:$d){ ${RECEPTION_FIELDS} } }`
const PROPOSALS = 'query($d:MarketplaceListStockProposalsInput){ marketplaceListStockProposals(data:$d){ id status } }'
const CANCEL_PROPOSAL = 'mutation($d:MarketplaceResolveStockProposalInput!){ marketplaceCancelStockProposal(data:$d){ id status } }'

/** Подписи акта приёмки: поставщик, затем председатель участка. Возвращает итоговый статус акта. */
async function finishReception(aplId: string): Promise<string> {
  const sp = await gql<any>(supplierToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionSupplierSignablePayloads(data:$d){ full_title html hash meta binary }
  }`, { d: { apl_reception_id: aplId } })
  const supplierSigned: any[] = []
  for (const p of sp.marketplaceAplReceptionSupplierSignablePayloads) supplierSigned.push(await signDocument(supplier.wif, p, supplier.account, 1))
  await gql(supplierToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsSupplier(data:$d){ apl_reception{ id status } }
  }`, { d: { apl_reception_id: aplId, signed_documents: supplierSigned } })
  const cp = await gql<any>(operatorToken, `query($d:MarketplaceAplReceptionByIdInput!){
    marketplaceAplReceptionChairmanSignablePayloads(data:$d){
      hash
      rawDocument{ full_title html hash meta binary }
      document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
    }
  }`, { d: { apl_reception_id: aplId } })
  const chairSigned: any[] = []
  for (const p of cp.marketplaceAplReceptionChairmanSignablePayloads) chairSigned.push(await signDocument(operator.wif, p.rawDocument, operator.account, 2, [p.document]))
  const cs = await gql<any>(operatorToken, `mutation($d:MarketplaceSignAplReceptionInput!){
    marketplaceSignAplReceptionAsChairman(data:$d){ apl_reception{ id status } }
  }`, { d: { apl_reception_id: aplId, signed_documents: chairSigned } })
  return cs.marketplaceSignAplReceptionAsChairman.apl_reception.status
}

describe('Стол заказов: оператор распоряжается только своим участком', () => {
  let price = 0
  /** Заказ, принятый на склад krg: его позиции склада и докладка. */
  let storedOrderId = ''
  let itemId = ''
  /** Заказ, по которому партия ждёт приёмки на krg. */
  let pendingOrderId = ''
  let shipmentId = ''

  beforeAll(async () => {
    memberToken = await tokenOf(member)
    supplierToken = await tokenOf(supplier)
    operatorToken = await tokenOf(operator)
    foreignToken = await tokenOf(foreign)

    const offer = await pickOffer(supplier.account, KRG, PRODUCT)
    price = amount(offer.price_per_unit)
    await ensureShareFunds(member.account, price * 8, memberToken)

    const stored = await placeOrder({ who: member, offerId: offer.id, quantity: 1 })
    storedOrderId = stored.orderId
    await acceptToCoop({ supplier, operator, orderId: storedOrderId, factQuantity: 1, factUnitPrice: price })
    const rows = await inventoryOfOrder(operatorToken, storedOrderId)
    expect(rows.length, 'принятый заказ лежит на складе krg').toBeGreaterThan(0)
    itemId = rows[0].id

    const pending = await placeOrder({ who: member, offerId: offer.id, quantity: 1 })
    pendingOrderId = pending.orderId
    await gql(supplierToken, 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }', { i: { order_ids: [pendingOrderId] } })
  }, 900_000)

  it(caseName('mkt.scope.side.01', 'оператор чужого участка не открывает акт приёмки по партии, даже зная её номер'), async () => {
    // Партию заводит экспресс-приёмка своего оператора; отмена акта возвращает
    // партию в ожидание приёмки — в этом состоянии её и пробует занять чужой.
    const fact = [{ order_id: pendingOrderId, fact_quantity: 1, fact_unit_price: price.toFixed(4) }]
    const ex = await gql<any>(operatorToken, EXPRESS, { d: { braname: KRG, offerer_account: supplier.account, fact_quantity_per_order: fact } })
    const first = (ex.marketplaceCreateExpressReception.apl_receptions as any[]).find(r => r.fact_quantity_per_order.some((f: any) => f.order_id === pendingOrderId))
    expect(first, 'экспресс-приёмка включила заказ').toBeTruthy()
    shipmentId = first.shipment_id
    await gql(operatorToken, CANCEL_RECEPTION, { d: { apl_reception_id: first.id } })

    const denied = await refusal(foreignToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: fact } })
    expect(denied?.codeText, denied?.message).toBe(NOT_TRUSTEE)

    const feed = await gql<any>(operatorToken, FEED, { d: { braname: KRG } })
    const open = (feed.marketplaceListAplReceptionsByBraname as any[])
      .filter(r => r.shipment_id === shipmentId && r.status !== 'CANCELLED')
    expect(open, 'чужой оператор партию не занял').toEqual([])

    // Свой оператор открывает акт по той же партии и доводит приёмку до конца,
    // чтобы после набора на участке не оставалось открытой партии.
    const own = await gql<any>(operatorToken, CREATE, { d: { shipment_id: shipmentId, fact_quantity_per_order: fact } })
    expect(own.marketplaceCreateAplReception.apl_reception.status).toBe('PENDING_SUPPLIER_SIGN')
    expect(await finishReception(own.marketplaceCreateAplReception.apl_reception.id)).toBe('ACCEPTED_TO_COOP')
  }, 600_000)

  it(caseName('mkt.scope.side.02', 'оператор чужого участка не маркирует, не перекладывает и не делит позиции склада'), async () => {
    const calls: [string, string, Record<string, unknown>][] = [
      ['наклеить штрих-код', 'mutation($d:MarketplaceGenerateInventoryLabelInput!){ marketplaceGenerateInventoryLabel(data:$d){ __typename } }', { inventory_id: itemId, format: 'EAN13' }],
      ['привязать штрих-код', 'mutation($d:MarketplaceBindInventoryBarcodeInput!){ marketplaceBindInventoryBarcode(data:$d){ __typename } }', { inventory_id: itemId, barcode_value: '4600000000017' }],
      ['снять штрих-код', 'mutation($d:MarketplaceClearInventoryLabelInput!){ marketplaceClearInventoryLabel(data:$d){ __typename } }', { inventory_id: itemId }],
      ['снять с места', 'mutation($d:MarketplaceAssignInventoryPlacementInput!){ marketplaceAssignInventoryPlacement(data:$d){ __typename } }', { inventory_id: itemId }],
      ['разделить', 'mutation($d:MarketplaceSplitInventoryInput!){ marketplaceSplitInventory(data:$d){ __typename } }', { inventory_id: itemId, splits: [{ quantity: 1 }] }],
    ]
    for (const [what, query, data] of calls) {
      const denied = await refusal(foreignToken, query, { d: data })
      expect(denied?.codeText, `${what}: ${denied?.message}`).toBe(NOT_TRUSTEE)
    }
    const after = (await inventoryOfOrder(operatorToken, storedOrderId)).find(r => r.id === itemId)
    expect(after?.status, 'позиция осталась немаркированной').toBe('RECEIVED')

    // Свой оператор маркирует ту же позицию.
    await gql(operatorToken, calls[0][1], { d: calls[0][2] })
    const labeled = (await inventoryOfOrder(operatorToken, storedOrderId)).find(r => r.id === itemId)
    expect(labeled?.status).toBe('LABELED')
  })

  it(caseName('mkt.scope.side.03', 'оператор чужого участка не публикует остаток склада и не снимает его с публикации'), async () => {
    const publish = await refusal(foreignToken, 'mutation($d:MarketplacePublishStockInput!){ marketplacePublishStock(data:$d){ id } }', { d: { inventory_ids: [itemId] } })
    expect(publish?.codeText, publish?.message).toBe(NOT_TRUSTEE)
    const unpublish = await refusal(foreignToken, 'mutation($d:MarketplaceUnpublishStockInput!){ marketplaceUnpublishStock(data:$d){ affected } }', { d: { inventory_ids: [itemId] } })
    expect(unpublish?.codeText, unpublish?.message).toBe(NOT_TRUSTEE)
    const after = (await inventoryOfOrder(operatorToken, storedOrderId)).find(r => r.id === itemId)
    expect(after?.published_offer_id ?? null, 'позиция не опубликована').toBeNull()
  })

  it(caseName('mkt.scope.side.04', 'оператор чужого участка не отменяет заказ, который выдаёт другой участок'), async () => {
    const denied = await refusal(foreignToken, 'mutation($d:MarketplaceCancelStockOrderInput!){ marketplaceCancelStockOrder(data:$d){ id status } }', { d: { order_id: storedOrderId } })
    expect(denied?.codeText, denied?.message).toBe(NOT_TRUSTEE)
    expect((await getOrder(memberToken, storedOrderId)).status, 'заказ остался на складе').toBe('ACCEPTED_TO_COOP')
  })

  it(caseName('mkt.scope.side.05', 'оператор чужого участка не отзывает бандл выдачи, собранный у стойки другого участка'), async () => {
    await ensureIdentityVerified(member.account)
    const created = await gql<any>(operatorToken, 'mutation($d:MarketplaceCreateStockProposalInput!){ marketplaceCreateStockProposal(data:$d){ id status } }', {
      d: { braname: KRG, member_account: member.account, order_items: [{ order_id: storedOrderId, actual_quantity: 1, actual_unit_price: price.toFixed(4) }] },
    })
    const proposalId = created.marketplaceCreateStockProposal.id as string

    const denied = await refusal(foreignToken, CANCEL_PROPOSAL, { d: { proposal_id: proposalId } })
    expect(denied?.codeText, denied?.message).toBe(NOT_TRUSTEE)
    const list = await gql<any>(operatorToken, PROPOSALS, { d: { braname: KRG } })
    expect((list.marketplaceListStockProposals as any[]).find(p => p.id === proposalId)?.status, 'бандл ждёт пайщика').toBe('PROPOSED')

    // Свой оператор отзывает бандл.
    const own = await gql<any>(operatorToken, CANCEL_PROPOSAL, { d: { proposal_id: proposalId } })
    expect(own.marketplaceCancelStockProposal.status).toBe('CANCELLED')
  })

  it(caseName('mkt.scope.side.06', 'оператор чужого участка не решает по гарантийному возврату другого участка'), async () => {
    // Отказ приходит до поиска заявления: участок в запросе чужой.
    const claimId = crypto.randomUUID()
    const calls: [string, string, Record<string, unknown>][] = [
      ['пригласить на осмотр', 'mutation($d:MarketplaceApproveReturnVisitInput!){ marketplaceApproveReturnVisit(data:$d){ claim{ id } } }', { claim_id: claimId, braname: KRG }],
      ['отказать удалённо', 'mutation($d:MarketplaceRejectReturnRemoteInput!){ marketplaceRejectReturnRemote(data:$d){ claim{ id } } }', { claim_id: claimId, braname: KRG, comment: 'проверка прав' }],
      ['отказать на месте', 'mutation($d:MarketplaceRejectReturnAtVisitInput!){ marketplaceRejectReturnAtVisit(data:$d){ claim{ id } } }', { claim_id: claimId, braname: KRG, inspection_result: 'проверка прав' }],
      ['выдать обратно', 'mutation($d:MarketplaceHandBackReturnInput!){ marketplaceHandBackReturn(data:$d){ claim{ id } } }', { claim_id: claimId, braname: KRG }],
    ]
    for (const [what, query, data] of calls) {
      const denied = await refusal(foreignToken, query, { d: data })
      expect(denied?.httpStatus, `${what}: ${denied?.codeText} ${denied?.message}`).toBe(403)
    }
    // Свой оператор проходит сверку участка и получает «заявление не найдено».
    const own = await refusal(operatorToken, calls[0][1], { d: calls[0][2] })
    expect(own?.httpStatus, `${own?.codeText} ${own?.message}`).not.toBe(403)
  })
})
