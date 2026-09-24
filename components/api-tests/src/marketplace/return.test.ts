/**
 * Гарантийный возврат имущества (реестр marketplace.return) снаружи: проверки
 * заявления пайщика, одно открытое заявление на заказ, решение робота совета
 * у стойки, претензия поставщику и остаток кооператива после возврата.
 *
 * Набор сам ведёт заказы от корзины до получения: основной (три единицы по
 * цене заказа), выданный со снижением цены и заказ по предложению, гарантию
 * которого набор на время оформления снимает до нуля.
 */
import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIRMAN,
  ROLES,
  type Who,
  amount,
  caseName,
  gql,
  signDocument,
  tokenOf,
  waitFor,
} from '../core'
import { KRG, getOrder, pickOffer, placeOrder, acceptToCoop, issueOrder } from './flow'
import { PHOTO, type IssuedOrder, fundShare, issuedOrder, refusal } from './mkt-flows.helpers'

const ekaterina = ROLES.member()
const ivanpetrov = ROLES.otherMember()
const sidorov = ROLES.supplier()
const chairkrg = ROLES.branchChairman()

let memberToken = ''
let otherToken = ''
let supplierToken = ''
let operatorToken = ''
let chairmanToken = ''

const CLAIM_FIELDS = 'id status order_id actual_quantity request_hash fact_cost fee_refund total_refund council_decision_id council_decision_mode'
const CREATE_CLAIM = `mutation($d:MarketplaceCreateReturnClaimInput!){ marketplaceCreateReturnClaim(data:$d){ tx_hash claim{ ${CLAIM_FIELDS} } } }`
const CLAIM_PAYLOAD = `query($d:MarketplaceReturnClaimSignablePayloadInput!){ marketplaceReturnClaimSignablePayload(data:$d){ full_title html hash meta binary } }`
const SUPPLIER_SUMMARY = 'query{ marketplaceSupplierClaimSummary{ admitted_debt not_admitted_total } }'
const ADMIT = 'mutation($d:MarketplaceAdmitSupplierClaimInput!){ marketplaceAdmitSupplierClaim(data:$d){ tx_hash claim{ id status } } }'

const REASON = 'Внешний слой: банка треснула при перевозке, мёд вытек.'

/** Подписанное пайщиком заявление 1106 по заказу — на указанное количество. */
async function signedStatement(who: Who, orderId: string, quantity: number, reason = REASON): Promise<any> {
  const d = await gql<any>(await tokenOf(who), CLAIM_PAYLOAD, { d: { order_id: orderId, actual_quantity: quantity, reason_text: reason } })
  return signDocument(who.wif, d.marketplaceReturnClaimSignablePayload, who.account, 1)
}

function claimInput(orderId: string, quantity: number, signed: unknown, over: Record<string, unknown> = {}) {
  return { d: { order_id: orderId, actual_quantity: quantity, reason_text: REASON, photos: [PHOTO], signed_statement: signed, ...over } }
}

async function myClaimsForOrder(orderId: string): Promise<any[]> {
  const d = await gql<any>(memberToken, 'query{ marketplaceListMyReturnClaims{ id status order_id actual_quantity } }')
  return (d.marketplaceListMyReturnClaims as any[]).filter(c => c.order_id === orderId)
}

async function claimById(token: string, claimId: string): Promise<any> {
  const d = await gql<any>(token, `query($c:String!){ marketplaceReturnClaim(claim_id:$c){ ${CLAIM_FIELDS} } }`, { c: claimId })
  return d.marketplaceReturnClaim
}

/** Заявление пайщика целиком: подпись заявления и подача с фото. */
async function submitClaim(orderId: string, quantity: number, photos = [PHOTO]): Promise<any> {
  const signed = await signedStatement(ekaterina, orderId, quantity)
  const d = await gql<any>(memberToken, CREATE_CLAIM, claimInput(orderId, quantity, signed, { photos }))
  return d.marketplaceCreateReturnClaim.claim
}

/**
 * Очный приём имущества у стойки: приглашение на осмотр, заявление оператора
 * в совет (первая подпись) и вторая подпись на рекламации пайщика.
 */
async function acceptAtVisit(claimId: string): Promise<{ claim: any, elapsedMs: number }> {
  await gql(operatorToken, 'mutation($d:MarketplaceApproveReturnVisitInput!){ marketplaceApproveReturnVisit(data:$d){ claim{ id status } } }',
    { d: { claim_id: claimId, braname: KRG, comment: 'Внешний слой: приглашение на очный осмотр.' } })
  const inspection = 'Внешний слой: дефект подтверждён на осмотре.'
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
  const signedCancel = await signDocument(chairkrg.wif, docs.cancel_statement, chairkrg.account, 1)
  const signedReclamation = await signDocument(chairkrg.wif, docs.reclamation.rawDocument, chairkrg.account, 2, [docs.reclamation.document])
  const started = Date.now()
  const r = await gql<any>(operatorToken, `mutation($d:MarketplaceAcceptReturnAtVisitInput!){ marketplaceAcceptReturnAtVisit(data:$d){ tx_hash claim{ ${CLAIM_FIELDS} } } }`, {
    d: { claim_id: claimId, braname: KRG, inspection_result: inspection, inspection_photos: [PHOTO], signed_statement: signedCancel, signed_reclamation: signedReclamation },
  })
  return { claim: r.marketplaceAcceptReturnAtVisit.claim, elapsedMs: Date.now() - started }
}

describe('гарантийный возврат: заявление, решение совета, претензия поставщику', () => {
  let order: IssuedOrder
  let summaryBefore = { admitted: 0, pending: 0 }

  beforeAll(async () => {
    memberToken = await tokenOf(ekaterina)
    otherToken = await tokenOf(ivanpetrov)
    supplierToken = await tokenOf(sidorov)
    operatorToken = await tokenOf(chairkrg)
    chairmanToken = await tokenOf(CHAIRMAN)

    const s = (await gql<any>(supplierToken, SUPPLIER_SUMMARY)).marketplaceSupplierClaimSummary
    summaryBefore = { admitted: amount(s.admitted_debt), pending: amount(s.not_admitted_total) }

    const offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
    order = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 3 })
    expect((await getOrder(memberToken, order.orderId)).status, 'заказ получен пайщицей').toBe('RECEIVED')
  }, 900_000)

  /** Подписанное заявление для проверок, где до подписи дело не доходит. */
  let anySigned: unknown

  it(caseName('mkt.ret.side.08', 'заявление без причины либо с причиной длиннее предела — отказ, заявление не заводится'), async () => {
    const signed = await signedStatement(ekaterina, order.orderId, 1)
    anySigned = signed

    const blank = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { reason_text: '    ' }))
    expect(blank?.codeText, blank?.message).toBe('MARKETPLACE_RETURN_CLAIM_REASON_REQUIRED')
    const empty = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { reason_text: '' }))
    expect(['400', '422', 'MARKETPLACE_RETURN_CLAIM_REASON_REQUIRED'], empty?.message).toContain(empty?.codeText)
    const long = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { reason_text: 'д'.repeat(2001) }))
    expect(long?.codeText, long?.message).toBe('MARKETPLACE_RETURN_CLAIM_REASON_TOO_LONG')

    expect(await myClaimsForOrder(order.orderId), 'отказ не оставляет заявления').toEqual([])
  })

  let firstClaim: any

  it(caseName('mkt.ret.side.09', 'без фото либо фото сверх предела — отказ; ровно предел проходит'), async () => {
    const signed = await signedStatement(ekaterina, order.orderId, 1)

    const none = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { photos: [] }))
    expect(['400', '422', 'MARKETPLACE_RETURN_CLAIM_PHOTO_REQUIRED'], none?.message).toContain(none?.codeText)
    const tooMany = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { photos: Array.from({ length: 11 }, () => PHOTO) }))
    expect(['400', '422', 'MARKETPLACE_RETURN_CLAIM_PHOTO_LIMIT'], tooMany?.message).toContain(tooMany?.codeText)
    expect(await myClaimsForOrder(order.orderId), 'отказ не оставляет заявления').toEqual([])

    // Ровно десять фото — граница, заявление принимается.
    const d = await gql<any>(memberToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed, { photos: Array.from({ length: 10 }, () => PHOTO) }))
    firstClaim = d.marketplaceCreateReturnClaim.claim
    expect(d.marketplaceCreateReturnClaim.tx_hash, 'заявление ушло в цепь').toBeTruthy()
    expect(firstClaim.status).toBe('PENDING_CHAIRMAN_REVIEW')
    expect(firstClaim.actual_quantity).toBe(1)
  })

  it(caseName('mkt.ret.side.03', 'заявление на возврат по чужому заказу — отказ доступа'), async () => {
    const preview = await refusal(otherToken, CLAIM_PAYLOAD, { d: { order_id: order.orderId, actual_quantity: 1, reason_text: REASON } })
    expect(preview?.codeText, preview?.message).toBe('MARKETPLACE_RETURN_CLAIM_NOT_ORDER_OWNER')

    const signed = await signedStatement(ekaterina, order.orderId, 1)
    const create = await refusal(otherToken, CREATE_CLAIM, claimInput(order.orderId, 1, signed))
    expect(create?.codeText, create?.message).toBe('MARKETPLACE_RETURN_CLAIM_NOT_ORDER_OWNER')
    expect((await myClaimsForOrder(order.orderId)).length, 'чужое заявление не заведено').toBe(1)
  })

  it(caseName('mkt.ret.side.04', 'вернуть больше полученного нельзя'), async () => {
    const preview = await refusal(memberToken, CLAIM_PAYLOAD, { d: { order_id: order.orderId, actual_quantity: order.quantity + 1, reason_text: REASON } })
    expect(preview?.codeText, preview?.message).toBe('MARKETPLACE_RETURN_CLAIM_QUANTITY_EXCEEDS_ISSUED')

    const signed = await signedStatement(ekaterina, order.orderId, 1)
    const create = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, order.quantity + 1, signed))
    expect(create?.codeText, create?.message).toBe('MARKETPLACE_RETURN_CLAIM_QUANTITY_EXCEEDS_ISSUED')
  })

  let claim: any

  it(caseName('mkt.ret.side.05', 'пока открыто одно заявление, второе не принимается; после закрытия — принимается'), async () => {
    const signed = await signedStatement(ekaterina, order.orderId, 2)
    const second = await refusal(memberToken, CREATE_CLAIM, claimInput(order.orderId, 2, signed))
    expect(second?.codeText, second?.message).toBe('MARKETPLACE_RETURN_CLAIM_ALREADY_OPEN')

    // Председатель участка закрывает первое заявление отказом.
    const rej = await gql<any>(operatorToken, 'mutation($d:MarketplaceRejectReturnRemoteInput!){ marketplaceRejectReturnRemote(data:$d){ claim{ id status } } }',
      { d: { claim_id: firstClaim.id, braname: KRG, comment: 'Внешний слой: по фото дефект не виден.' } })
    expect(rej.marketplaceRejectReturnRemote.claim.status).toBe('REJECTED_REMOTELY')

    const d = await gql<any>(memberToken, CREATE_CLAIM, claimInput(order.orderId, 2, signed))
    claim = d.marketplaceCreateReturnClaim.claim
    expect(claim.status).toBe('PENDING_CHAIRMAN_REVIEW')
    expect(claim.id).not.toBe(firstClaim.id)
    expect(claim.actual_quantity).toBe(2)
  })

  it(caseName('mkt.return.side.fact-01', 'робот совета решает, пока мутация ждёт у стойки: ответ уже с решением'), async () => {
    const { claim: accepted, elapsedMs } = await acceptAtVisit(claim.id)
    expect(accepted.council_decision_id, 'заявление на повестке совета').toBeTruthy()
    expect(accepted.council_decision_mode, 'на стенде решение по отмене сделки принимает робот').toBe('ROBOT')
    expect(accepted.status, `ответ стойки уже несёт решение совета (ждали ${elapsedMs} мс)`).toBe('ACCEPTED_BY_COUNCIL')
    claim = accepted
  })

  let supplierClaim: any

  it(caseName('mkt.ret.side.51', 'сводка поставщика: непризнанное — с кошелька претензий, признанное — с кошелька долга; пусто — ноль'), async () => {
    supplierClaim = await waitFor(async () => {
      const d = await gql<any>(supplierToken, 'query{ marketplaceListSupplierClaims{ id claim_hash status amount supplier_account return_claim_id } }')
      return (d.marketplaceListSupplierClaims as any[]).find(c => c.return_claim_id === claim.id) ?? null
    }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'претензия поставщику по решению совета' })
    expect(supplierClaim.status).toBe('PENDING')
    expect(supplierClaim.supplier_account).toBe(sidorov.account)
    expect(amount(supplierClaim.amount), 'претензия — на стоимость возвращённого').toBeCloseTo(amount(claim.fact_cost), 4)

    // Хэш претензии выводится из хэша рекламации: sha256(байты хэша ‖ "claim").
    const expectedHash = createHash('sha256').update(Buffer.concat([Buffer.from(claim.request_hash, 'hex'), Buffer.from('claim', 'utf8')])).digest('hex')
    expect(supplierClaim.claim_hash.toLowerCase()).toBe(expectedHash)

    const pending = await waitFor(async () => {
      const s = (await gql<any>(supplierToken, SUPPLIER_SUMMARY)).marketplaceSupplierClaimSummary
      return Math.abs(amount(s.not_admitted_total) - summaryBefore.pending - amount(supplierClaim.amount)) < 0.00005 ? s : null
    }, { timeoutMs: 60_000, intervalMs: 1_500, label: 'непризнанная претензия в сводке поставщика' })
    expect(amount(pending.admitted_debt), 'до согласия долга нет').toBeCloseTo(summaryBefore.admitted, 4)

    // У поставщика без претензий оба кошелька пусты — сводка отдаёт нули.
    const empty = (await gql<any>(otherToken, SUPPLIER_SUMMARY)).marketplaceSupplierClaimSummary
    expect(amount(empty.admitted_debt)).toBe(0)
    expect(amount(empty.not_admitted_total)).toBe(0)
  })

  it(caseName('mkt.ret.side.50', 'согласие чужого поставщика и повторное согласие — отказ'), async () => {
    const foreign = await refusal(otherToken, ADMIT, { d: { claim_id: supplierClaim.id } })
    expect(foreign?.codeText, foreign?.message).toBe('MARKETPLACE_SUPPLIER_CLAIM_NOT_ADDRESSEE')
    const still = await gql<any>(supplierToken, 'query($c:String!){ marketplaceSupplierClaim(claim_id:$c){ id status } }', { c: supplierClaim.id })
    expect(still.marketplaceSupplierClaim.status, 'чужое согласие не тронуло претензию').toBe('PENDING')

    const ok = await gql<any>(supplierToken, ADMIT, { d: { claim_id: supplierClaim.id } })
    expect(ok.marketplaceAdmitSupplierClaim.claim.status).toBe('ADMITTED')
    expect(ok.marketplaceAdmitSupplierClaim.tx_hash).toBeTruthy()

    const again = await refusal(supplierToken, ADMIT, { d: { claim_id: supplierClaim.id } })
    expect(again?.codeText, again?.message).toBe('MARKETPLACE_SUPPLIER_CLAIM_ALREADY_ACKNOWLEDGED')

    // Согласие переносит сумму из непризнанного в долг к удержанию.
    const s = (await gql<any>(supplierToken, SUPPLIER_SUMMARY)).marketplaceSupplierClaimSummary
    expect(amount(s.admitted_debt) - summaryBefore.admitted, 'признанный долг — сумма претензии').toBeCloseTo(amount(supplierClaim.amount), 4)
    expect(amount(s.not_admitted_total), 'непризнанного по претензии не осталось').toBeCloseTo(summaryBefore.pending, 4)
  })

  it(caseName('mkt.ret.side.53', 'возврат имущества, выданного со снижением цены, — в остаток по цене выдачи'), async () => {
    const offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
    const price = amount(offer.price_per_unit)
    const issuePrice = Math.floor(price * 80) / 100
    const marked = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 1, issueUnitPrice: issuePrice })

    const c = await submitClaim(marked.orderId, 1)
    const { claim: decided } = await acceptAtVisit(c.id)
    expect(amount(decided.fact_cost), 'к возврату — сумма выдачи').toBeCloseTo(issuePrice, 4)

    const item = await waitFor(async () => {
      const d = await gql<any>(operatorToken, `query($d:MarketplaceListInventoryInput){
        marketplaceListInventory(data:$d){ id order_id origin return_claim_id arrival_price quantity_per_label ownership }
      }`, { d: { order_id: marked.orderId } })
      return (d.marketplaceListInventory as any[]).find(i => i.return_claim_id === c.id) ?? null
    }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'возвращённое имущество в остатке участка' })
    expect(item.origin).toBe('WARRANTY_RETURN')
    expect(item.ownership).toBe('COOP')
    expect(amount(item.arrival_price), `остаток по цене выдачи ${issuePrice}, а не прибытия ${price}`).toBeCloseTo(issuePrice, 4)
  })

  it(caseName('mkt.ret.side.01', 'по предложению с нулевой гарантией заявление не заводится'), async () => {
    // Гарантию задаёт председатель на предложении, в заказ она попадает при
    // оформлении. Набор ставит нулевую гарантию на время своего заказа и сразу
    // возвращает прежнюю — файлы идут по очереди, чужих заказов в этом окне нет.
    const bread: any = await pickOffer(sidorov.account, KRG, 'Хлеб подовый ржано-пшеничный')
    const unit = amount(bread.price_per_unit)
    const warrantyBefore = Number(bread.warranty_days ?? 3)
    const SET_WARRANTY = 'mutation($i:MarketplaceSetOfferWarrantyInput!){ marketplaceSetOfferWarranty(input:$i){ id warranty_days } }'
    await fundShare(ekaterina, 2 * unit * 2)
    await gql(chairmanToken, SET_WARRANTY, { i: { offer_id: bread.id, warranty_days: 0 } })
    let placed!: { orderId: string, orderHash: string }
    try {
      placed = await placeOrder({ who: ekaterina, offerId: bread.id, quantity: 2 })
    }
    finally {
      await gql(chairmanToken, SET_WARRANTY, { i: { offer_id: bread.id, warranty_days: warrantyBefore } })
    }
    await acceptToCoop({ supplier: sidorov, operator: chairkrg, orderId: placed.orderId, factQuantity: 2, factUnitPrice: unit })
    await issueOrder({ operator: chairkrg, member: ekaterina, orderId: placed.orderId, actualQuantity: 2, actualUnitPrice: unit })

    const got = await gql<any>(memberToken, 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id status warranty_period_secs warranty_until } }', { i: { order_id: placed.orderId } })
    expect(got.marketplaceGetOrder.status).toBe('RECEIVED')
    expect(got.marketplaceGetOrder.warranty_period_secs).toBe(0)
    expect(got.marketplaceGetOrder.warranty_until ?? null, 'гарантийного окна нет').toBeNull()

    const preview = await refusal(memberToken, CLAIM_PAYLOAD, { d: { order_id: placed.orderId, actual_quantity: 1, reason_text: REASON } })
    expect(preview?.codeText, preview?.message).toBe('MARKETPLACE_RETURN_CLAIM_NO_WARRANTY')
    // Заявление по такому заказу не собирается вовсе; право на возврат
    // проверяется раньше подписи, поэтому подойдёт любое подписанное.
    const create = await refusal(memberToken, CREATE_CLAIM, claimInput(placed.orderId, 1, anySigned))
    expect(create?.codeText, create?.message).toBe('MARKETPLACE_RETURN_CLAIM_NO_WARRANTY')
    expect(await myClaimsForOrder(placed.orderId), 'заявление не заведено').toEqual([])
  })
})
