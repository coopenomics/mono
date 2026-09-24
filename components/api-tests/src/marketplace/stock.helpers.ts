/**
 * Шаги остатка кооператива для внешних тестов: склад участка, публикация,
 * докладка у стойки (заказ из остатка) и гарантийный возврат. Как и в
 * flow.ts, здесь только действия и чтение — проверки живут в тестах.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { waitFor } from '../core/wait'
import { KRG, SAGA_FIELDS, ensureIdentityVerified, sagaOf } from './flow'

export const INVENTORY_FIELDS = 'id order_id shipment_id braname ownership origin status quantity_per_label arrival_price published_offer_id reserved_order_id return_claim_id'

/** Свободный остаток кооператива на участке — глазами оператора склада. */
export async function listStock(operatorToken: string, braname = KRG): Promise<any[]> {
  const d = await gql<any>(operatorToken, `query($b:String){ marketplaceListStock(braname:$b){ ${INVENTORY_FIELDS} } }`, { b: braname })
  return d.marketplaceListStock
}

/** Все позиции склада по заказу-происхождению, включая выданные. */
export async function inventoryOfOrder(operatorToken: string, orderId: string): Promise<any[]> {
  const d = await gql<any>(operatorToken, `query($d:MarketplaceListInventoryInput){ marketplaceListInventory(data:$d){ ${INVENTORY_FIELDS} } }`, {
    d: { order_id: orderId, statuses: ['RECEIVED', 'LABELED', 'ISSUED', 'RETURNED', 'WRITTEN_OFF'] },
  })
  return d.marketplaceListInventory
}

export const PUBLISH_STOCK = `mutation($d:MarketplacePublishStockInput!){
  marketplacePublishStock(data:$d){ id status stock_braname price_per_unit warranty_days quantity_available quantity_blocked supplier_account }
}`

export const STOCK_ISSUANCE_PAYLOADS = `query($d:MarketplaceStockIssuancePrepareInput!){
  marketplaceStockIssuancePayloads(data:$d){ offer_id quantity order_hash unit_price package_id }
}`

export async function getOffer(token: string, id: string): Promise<any> {
  const d = await gql<any>(token, 'query($id:String!){ marketplaceGetOffer(id:$id){ id status stock_braname price_per_unit quantity_available quantity_blocked quantity_consumed warranty_days } }', { id })
  return d.marketplaceGetOffer
}

/**
 * Докладка со склада до подписи пайщика: оператор готовит строки и бандл,
 * пайщик подписывает заявления (и 1110, если членского кошелька не хватает).
 * На подписи рождается заказ из остатка — с резервом позиций склада.
 */
export async function orderFromStock(args: { operator: Who, member: Who, offerId: string, quantity: number, braname?: string }): Promise<{ proposalId: string, orderId: string, orderHash: string }> {
  const { operator, member, offerId, quantity, braname = KRG } = args
  const operatorToken = await tokenOf(operator)
  const memberToken = await tokenOf(member)
  await ensureIdentityVerified(member.account)
  const pl = await gql<any>(operatorToken, STOCK_ISSUANCE_PAYLOADS, {
    d: { braname, member_account: member.account, items: [{ offer_id: offerId, quantity }] },
  })
  const line = pl.marketplaceStockIssuancePayloads[0]
  const prop = await gql<any>(operatorToken, `mutation($d:MarketplaceCreateStockProposalInput!){
    marketplaceCreateStockProposal(data:$d){ id status }
  }`, { d: { braname, member_account: member.account, items: [{ offer_id: offerId, quantity, order_hash: line.order_hash, package_id: line.package_id }] } })
  const proposalId = prop.marketplaceCreateStockProposal.id as string
  const pay = await gql<any>(memberToken, `query($d:MarketplaceResolveStockProposalInput!){
    marketplaceStockProposalSignablePayloads(data:$d){
      order_lines{ offer_id order_id order_hash statement{ full_title html hash meta binary } }
      convert{ amount membership_fee document{ full_title html hash meta binary } }
    }
  }`, { d: { proposal_id: proposalId } })
  const payload = pay.marketplaceStockProposalSignablePayloads
  const orderLines: any[] = []
  for (const l of payload.order_lines as any[]) orderLines.push({ order_hash: l.order_hash, signed_statement: await signDocument(member.wif, l.statement, member.account, 1) })
  const signedConvert = payload.convert ? await signDocument(member.wif, payload.convert.document, member.account, 1) : null
  const fin = await gql<any>(memberToken, `mutation($d:MarketplaceFinalizeStockIssuanceInput!){
    marketplaceFinalizeStockIssuance(data:$d){ proposal{ id status } order_ids sagas{ ${SAGA_FIELDS} } }
  }`, { d: { proposal_id: proposalId, order_lines: orderLines, signed_convert: signedConvert } })
  const orderId = fin.marketplaceFinalizeStockIssuance.order_ids[0] as string
  const ord = await gql<any>(memberToken, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id order_hash } }', { i: { order_id: orderId } })
  return { proposalId, orderId, orderHash: ord.marketplaceGetOrder.order_hash as string }
}

/**
 * Хвост выдачи после подачи заявлений: решение совета (робот стенда), акт
 * пайщика, закрывающая подпись оператора.
 */
export async function completeIssuance(args: { operator: Who, member: Who, orderId: string }): Promise<void> {
  const { operator, member, orderId } = args
  const operatorToken = await tokenOf(operator)
  const memberToken = await tokenOf(member)
  await waitFor(async () => ((await sagaOf(memberToken, orderId))?.awaits_member_signature ? true : null),
    { timeoutMs: 180_000, intervalMs: 1_500, label: `сага выдачи ${orderId}: решение совета` })
  const actPl = await gql<any>(memberToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceActPayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId } })
  await gql(memberToken, `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceSignIssuanceAct(data:$d){ ${SAGA_FIELDS} } }`,
    { d: { order_id: orderId, signed_act: await signDocument(member.wif, actPl.marketplaceIssuanceActPayload, member.account, 1) } })
  const closePl = await gql<any>(operatorToken, `query($d:MarketplaceIssuanceOrderInput!){
    marketplaceIssuanceClosePayload(data:$d){
      act_aggregate{
        hash
        rawDocument{ full_title html hash meta binary }
        document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
      }
    }
  }`, { d: { order_id: orderId } })
  const agg = closePl.marketplaceIssuanceClosePayload.act_aggregate
  await gql(operatorToken, `mutation($d:MarketplaceSignIssuanceActInput!){ marketplaceCloseIssuance(data:$d){ ${SAGA_FIELDS} } }`,
    { d: { order_id: orderId, signed_act: await signDocument(operator.wif, agg.rawDocument, operator.account, 2, [agg.document]) } })
}

/** Минимальный валидный PNG 1×1: фото обязательны по форме заявления и осмотра. */
const PHOTO = { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', mime_type: 'image/png' }

/**
 * Гарантийный возврат целиком: заявление пайщика, приглашение на осмотр,
 * приём имущества у стойки двумя подписями оператора. Решение совета
 * принимает робот стенда (mktretrn делегирован boot:extra).
 */
export async function returnAtVisit(args: { operator: Who, member: Who, orderId: string, quantity: number, braname?: string }): Promise<{ claimId: string, acceptStatus: string }> {
  const { operator, member, orderId, quantity, braname = KRG } = args
  const operatorToken = await tokenOf(operator)
  const memberToken = await tokenOf(member)
  const reason = 'Внешний тест: гарантийный возврат имущества из остатка кооператива.'
  const pl = await gql<any>(memberToken, `query($d:MarketplaceReturnClaimSignablePayloadInput!){
    marketplaceReturnClaimSignablePayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId, actual_quantity: quantity, reason_text: reason } })
  const cr = await gql<any>(memberToken, `mutation($d:MarketplaceCreateReturnClaimInput!){
    marketplaceCreateReturnClaim(data:$d){ claim { id status } }
  }`, {
    d: {
      order_id: orderId,
      actual_quantity: quantity,
      reason_text: reason,
      photos: [PHOTO],
      signed_statement: await signDocument(member.wif, pl.marketplaceReturnClaimSignablePayload, member.account, 1),
    },
  })
  const claimId = cr.marketplaceCreateReturnClaim.claim.id as string
  await gql(operatorToken, `mutation($d:MarketplaceApproveReturnVisitInput!){
    marketplaceApproveReturnVisit(data:$d){ claim { id status } }
  }`, { d: { claim_id: claimId, braname, comment: 'Приглашение на очный осмотр (внешний тест).' } })
  const inspection = 'Дефект подтверждён на очном осмотре (внешний тест).'
  const cp = await gql<any>(operatorToken, `query($c:String!,$r:String!){
    marketplaceReturnClaimChairmanSignablePayload(claim_id:$c, inspection_result:$r){
      cancel_statement{ full_title html hash meta binary }
      reclamation{
        hash
        rawDocument{ full_title html hash meta binary }
        document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }
      }
    }
  }`, { c: claimId, r: inspection })
  const docs = cp.marketplaceReturnClaimChairmanSignablePayload
  const acc = await gql<any>(operatorToken, `mutation($d:MarketplaceAcceptReturnAtVisitInput!){
    marketplaceAcceptReturnAtVisit(data:$d){ claim { id status council_decision_mode } }
  }`, {
    d: {
      claim_id: claimId,
      braname,
      inspection_result: inspection,
      inspection_photos: [PHOTO],
      signed_statement: await signDocument(operator.wif, docs.cancel_statement, operator.account, 1),
      signed_reclamation: await signDocument(operator.wif, docs.reclamation.rawDocument, operator.account, 2, [docs.reclamation.document]),
    },
  })
  return { claimId, acceptStatus: acc.marketplaceAcceptReturnAtVisit.claim.status as string }
}
