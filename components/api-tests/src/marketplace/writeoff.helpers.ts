/**
 * Гарантийный возврат выданного имущества на склад участка — подготовка для
 * случаев списания, где на складе нужна партия с происхождением «возврат по
 * гарантии». Путь тот же, что у рабочего стола: заявление пайщика с фото →
 * приглашение на осмотр → приём у стойки двумя подписями председателя
 * участка → решение совета (на стенде — робот) → имущество в остатке.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { KRG } from './flow'

/** Минимальный валидный PNG 1×1: фото обязательны по форме заявления. */
const PHOTO = {
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  mime_type: 'image/png',
}

export async function warrantyReturn(args: { member: Who, operator: Who, orderId: string, quantity: number }): Promise<{ claimId: string, status: string }> {
  const { member, operator, orderId, quantity } = args
  const memberToken = await tokenOf(member)
  const operatorToken = await tokenOf(operator)
  const reason = 'Внешний тест: брак, возврат по гарантии.'

  const pl = await gql<any>(memberToken, `query($d:MarketplaceReturnClaimSignablePayloadInput!){
    marketplaceReturnClaimSignablePayload(data:$d){ full_title html hash meta binary }
  }`, { d: { order_id: orderId, actual_quantity: quantity, reason_text: reason } })
  const cr = await gql<any>(memberToken, `mutation($d:MarketplaceCreateReturnClaimInput!){
    marketplaceCreateReturnClaim(data:$d){ claim{ id status } }
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

  await gql(operatorToken, `mutation($d:MarketplaceApproveReturnVisitInput!){ marketplaceApproveReturnVisit(data:$d){ claim{ id status } } }`, {
    d: { claim_id: claimId, braname: KRG, comment: 'Приглашение на очный осмотр (внешний тест).' },
  })

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
    marketplaceAcceptReturnAtVisit(data:$d){ claim{ id status council_decision_mode } }
  }`, {
    d: {
      claim_id: claimId,
      braname: KRG,
      inspection_result: inspection,
      inspection_photos: [PHOTO],
      signed_statement: await signDocument(operator.wif, docs.cancel_statement, operator.account, 1),
      signed_reclamation: await signDocument(operator.wif, docs.reclamation.rawDocument, operator.account, 2, [docs.reclamation.document]),
    },
  })
  return { claimId, status: acc.marketplaceAcceptReturnAtVisit.claim.status as string }
}

export const CANDIDATES = `query{
  marketplaceListWriteoffCandidates{ key braname asset_title origin quantity lots_count inventory_ids is_expired expiry_date }
}`
