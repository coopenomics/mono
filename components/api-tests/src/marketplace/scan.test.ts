/**
 * Стол заказов: единый сканер стола ПВЗ — визит пайщика по любому коду
 * (test-registry/marketplace.scan.yaml, задача 598-62).
 *
 * Оператор участка сканирует любой код одним сканером: код заказчика, код
 * поставщика, код заявления на возврат, голый логин, QR накладной, QR бокса.
 * Сервер разбирает строку и отвечает визитом: кто пришёл и какие дела у него
 * на этом участке в порядке приоритета — выдать заказы, принять поставку,
 * осмотреть возврат. Код партии и код бокса ведут к предмету.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, type Who, amount, caseName, expectCode, gql, gqlError, signDocument, tokenOf } from '../core'
import { KRG, pickOffer, placeOrder } from './flow'
import { PHOTO, fundShare, issuedOrder } from './mkt-flows.helpers'
import { prepareReceivedOrder } from './issuance.helpers'

const VISIT = 'target account display_name matters{ kind ids } focus_claim_id shipment_id container_code'
const SCAN = `query($d:MarketplaceResolveScanInput!){ marketplaceResolveScan(data:$d){ ${VISIT} } }`
const CODE = 'query($d:MarketplaceHandoffCodeInput!){ marketplaceHandoffCode(data:$d){ kind code expires_at } }'
const CREATE_TYPE = 'mutation($d:MarketplaceCreateContainerTypeInput!){ marketplaceCreateContainerType(data:$d){ id } }'
const CREATE_BOXES = 'mutation($d:MarketplaceCreateContainersInput!){ marketplaceCreateContainers(data:$d){ id code braname } }'
const UPDATE_BOX = 'mutation($d:MarketplaceUpdateContainerInput!){ marketplaceUpdateContainer(data:$d){ id is_active } }'
const ACCEPT = 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }'
const ORDER = 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id status cycle_id } }'
const CREATE_SHIPMENT = 'mutation($d:MarketplaceCreateShipmentInput!){ marketplaceCreateShipment(data:$d){ shipments{ id braname } } }'
const CLAIM_PAYLOAD = 'query($d:MarketplaceReturnClaimSignablePayloadInput!){ marketplaceReturnClaimSignablePayload(data:$d){ full_title html hash meta binary } }'
const CREATE_CLAIM = 'mutation($d:MarketplaceCreateReturnClaimInput!){ marketplaceCreateReturnClaim(data:$d){ claim{ id status } } }'
const APPROVE_VISIT = 'mutation($d:MarketplaceApproveReturnVisitInput!){ marketplaceApproveReturnVisit(data:$d){ claim{ id status } } }'

const ODN = 'odn'
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const REASON = 'Внешний слой: банка треснула при перевозке, мёд вытек.'

const ekaterina = ROLES.member()
const ivanpetrov = ROLES.otherMember()
const sidorov = ROLES.supplier()
const chairkrg = ROLES.branchChairman()
const chairodn = ROLES.foreignBranchChairman()

let memberToken = ''
let supplierToken = ''
let operatorToken = ''
let foreignToken = ''
let chairmanToken = ''
let offer: { id: string, price_per_unit: string }

async function scan(token: string, braname: string, code: string): Promise<any> {
  return (await gql<any>(token, SCAN, { d: { braname, code } })).marketplaceResolveScan
}

function matter(visit: any, kind: string): any | undefined {
  return (visit.matters as any[]).find(m => m.kind === kind)
}

function denied(err: { code: string | null } | null): void {
  expect(err, 'ожидался отказ по правам').not.toBeNull()
  expect(['403', 'KIT_INSUFFICIENT_RIGHTS', 'KIT_RIGHT_SCOPE_OWN_KU', 'MARKETPLACE_NOT_A_MEMBER']).toContain(String(err!.code))
}

/** Заявление на возврат по полученному заказу, одобренное на очный осмотр. */
async function claimApprovedForVisit(who: Who, orderId: string): Promise<string> {
  const d = await gql<any>(await tokenOf(who), CLAIM_PAYLOAD, { d: { order_id: orderId, actual_quantity: 1, reason_text: REASON } })
  const signed = await signDocument(who.wif, d.marketplaceReturnClaimSignablePayload, who.account, 1)
  const created = await gql<any>(memberToken, CREATE_CLAIM, {
    d: { order_id: orderId, actual_quantity: 1, reason_text: REASON, photos: [PHOTO], signed_statement: signed },
  })
  const claimId = created.marketplaceCreateReturnClaim.claim.id as string
  const approved = await gql<any>(operatorToken, APPROVE_VISIT, { d: { claim_id: claimId, braname: KRG, comment: 'Внешний слой: приглашение на осмотр.' } })
  expect(approved.marketplaceApproveReturnVisit.claim.status).toBe('APPROVED_FOR_VISIT')
  return claimId
}

beforeAll(async () => {
  memberToken = await tokenOf(ekaterina)
  supplierToken = await tokenOf(sidorov)
  operatorToken = await tokenOf(chairkrg)
  foreignToken = await tokenOf(chairodn)
  chairmanToken = await tokenOf(CHAIRMAN)
  offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
}, 120_000)

describe('Стол заказов — единый сканер: разбор кода', () => {
  it(caseName('mkt.scan.happy.01', 'код заказчика и голый логин ведут к одному и тому же пайщику; код поставщика — к нему же'), async () => {
    const byCode = await scan(operatorToken, KRG, `blago:receive:${COOP}:${ivanpetrov.account}`)
    const byLogin = await scan(operatorToken, KRG, ivanpetrov.account)
    expect(byCode).toMatchObject({ target: 'PERSON', account: ivanpetrov.account, shipment_id: null, container_code: null })
    expect(byLogin).toMatchObject({ target: 'PERSON', account: ivanpetrov.account })
    expect(byLogin.matters).toEqual(byCode.matters)
    const supplierVisit = await scan(operatorToken, KRG, `blago:pickup:${COOP}:${sidorov.account}`)
    expect(supplierVisit).toMatchObject({ target: 'PERSON', account: sidorov.account })
  })

  it(caseName('mkt.scan.side.01', 'пустая строка, адрес сайта, лишний сегмент и неизвестный вид — код не распознан'), async () => {
    for (const code of ['   ', 'https://example.org', `blago:receive:${COOP}:${ivanpetrov.account}:extra`, `blago:order:${COOP}:1`, `blago:receive::${ivanpetrov.account}`]) {
      const err = await gqlError(operatorToken, SCAN, { d: { braname: KRG, code } })
      expect(['422', 'MARKETPLACE_SCAN_CODE_UNRECOGNIZED'], `код «${code}»`).toContain(String(err?.code))
    }
  })

  it(caseName('mkt.scan.happy.06', 'пайщик получает свой код на получение и на приёмку — бессрочно'), async () => {
    const receive = (await gql<any>(memberToken, CODE, { d: { kind: 'RECEIVE' } })).marketplaceHandoffCode
    expect(receive).toEqual({ kind: 'RECEIVE', code: `blago:receive:${COOP}:${ekaterina.account}`, expires_at: null })
    const pickup = (await gql<any>(supplierToken, CODE, { d: { kind: 'PICKUP' } })).marketplaceHandoffCode
    expect(pickup).toMatchObject({ kind: 'PICKUP', code: `blago:pickup:${COOP}:${sidorov.account}` })
    // Код, который выдал сервер, сервер же и разбирает.
    expect(await scan(operatorToken, KRG, receive.code)).toMatchObject({ target: 'PERSON', account: ekaterina.account })
  })
})

describe('Стол заказов — единый сканер: дела пайщика', () => {
  let issuanceOrderId = ''
  let claimId = ''

  beforeAll(async () => {
    const price = amount(offer.price_per_unit)
    await fundShare(ekaterina, price * 8)
    // Заказ к выдаче: принят кооперативом на участок, пайщик ещё не пришёл.
    issuanceOrderId = (await prepareReceivedOrder({
      member: ekaterina, supplier: sidorov, operator: chairkrg, offerId: offer.id, quantity: 1, receivedQuantity: 1, arrivalPrice: price,
    })).orderId
    // Полученный заказ и заявление на возврат, одобренное на осмотр.
    const received = await issuedOrder({ member: ekaterina, supplier: sidorov, operator: chairkrg, offer, quantity: 1 })
    claimId = await claimApprovedForVisit(ekaterina, received.orderId)
  }, 900_000)

  it(caseName('mkt.scan.happy.02', 'у заказчика на участке заказ к выдаче и одобренный возврат — дела в порядке выдача, затем возврат; чужие дела не попадают'), async () => {
    const visit = await scan(operatorToken, KRG, `blago:receive:${COOP}:${ekaterina.account}`)
    expect(visit).toMatchObject({ target: 'PERSON', account: ekaterina.account, focus_claim_id: null })
    expect(visit.display_name, 'имя из сертификата').toBeTruthy()
    const kinds = (visit.matters as any[]).map(m => m.kind)
    expect(kinds.indexOf('ISSUANCE'), 'выдача раньше возврата').toBeLessThan(kinds.indexOf('RETURN'))
    expect(matter(visit, 'ISSUANCE').ids).toContain(issuanceOrderId)
    expect(matter(visit, 'RETURN').ids).toContain(claimId)
    const other = await scan(operatorToken, KRG, ivanpetrov.account)
    expect(matter(other, 'ISSUANCE')?.ids ?? []).not.toContain(issuanceOrderId)
    expect(matter(other, 'RETURN')?.ids ?? []).not.toContain(claimId)
  })

  it(caseName('mkt.scan.happy.03', 'код заявления ведёт к заявителю и отмечает заявление, если оно ждёт осмотра здесь'), async () => {
    const visit = await scan(operatorToken, KRG, `blago:return:${COOP}:${claimId}`)
    expect(visit).toMatchObject({ target: 'PERSON', account: ekaterina.account, focus_claim_id: claimId })
    expect(matter(visit, 'RETURN').ids).toContain(claimId)
  })

  it(caseName('mkt.scan.side.02', 'код заявления на другом участке: визит заявителя собирается, заявление не отмечается'), async () => {
    // Председатель кооператива видит любой участок; заявление ждёт осмотра на КРГ, а не на ОДН.
    const visit = await scan(chairmanToken, ODN, `blago:return:${COOP}:${claimId}`)
    expect(visit).toMatchObject({ target: 'PERSON', account: ekaterina.account, focus_claim_id: null })
    expect(matter(visit, 'RETURN')?.ids ?? []).not.toContain(claimId)
  })

  it(caseName('mkt.scan.side.03', 'пайщик без дел на этом участке — визит с пустым списком дел, не ошибка'), async () => {
    const visit = await scan(chairmanToken, ODN, `blago:receive:${COOP}:${ekaterina.account}`)
    expect(visit).toMatchObject({ target: 'PERSON', account: ekaterina.account })
    expect(matter(visit, 'ISSUANCE')?.ids ?? []).not.toContain(issuanceOrderId)
  })
})

describe('Стол заказов — единый сканер: партия и бокс', () => {
  let shipmentId = ''
  let box: { id: string, code: string }

  beforeAll(async () => {
    const price = amount(offer.price_per_unit)
    await fundShare(ekaterina, price * 2)
    const placed = await placeOrder({ who: ekaterina, offerId: offer.id, quantity: 1 })
    await gql(supplierToken, ACCEPT, { i: { order_ids: [placed.orderId] } })
    const accepted = (await gql<any>(memberToken, ORDER, { i: { order_id: placed.orderId } })).marketplaceGetOrder
    const d = await gql<any>(supplierToken, CREATE_SHIPMENT, { d: { cycle_id: accepted.cycle_id, groups: [{ braname: KRG, delivery_variant: 'SELF', order_ids: [placed.orderId] }] } })
    shipmentId = d.marketplaceCreateShipment.shipments[0].id
    const T = Date.now().toString(36).toUpperCase()
    const type = (await gql<any>(chairmanToken, CREATE_TYPE, { d: { name: `Скан ${T}`, length_cm: 30, width_cm: 20, height_cm: 10, max_weight_kg: '5' } })).marketplaceCreateContainerType
    box = (await gql<any>(operatorToken, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 1, label: `Скан ${T}` } })).marketplaceCreateContainers[0]
  }, 300_000)

  it(caseName('mkt.scan.happy.04', 'QR накладной ведёт к партии своего участка, дел нет'), async () => {
    const visit = await scan(operatorToken, KRG, `blago:shipment:${COOP}:${shipmentId}`)
    expect(visit).toMatchObject({ target: 'SHIPMENT', shipment_id: shipmentId, account: null, matters: [] })
    // Поставщик этой партии приходит на приёмку — его код даёт дело «принять поставку».
    const supplierVisit = await scan(operatorToken, KRG, `blago:pickup:${COOP}:${sidorov.account}`)
    expect(matter(supplierVisit, 'RECEPTION')?.ids ?? []).not.toHaveLength(0)
  })

  it(caseName('mkt.scan.happy.05', 'QR бокса и код с этикетки ведут к боксу своего участка'), async () => {
    expect(await scan(operatorToken, KRG, `blago:container:${COOP}:${box.code}`)).toMatchObject({ target: 'CONTAINER', container_code: box.code, matters: [] })
    expect(await scan(operatorToken, KRG, box.code.toLowerCase())).toMatchObject({ target: 'CONTAINER', container_code: box.code })
  })

  it(caseName('mkt.scan.break.01', 'партия и бокс другого участка, чужой кооператив, несуществующие заявление и партия — отказ своим кодом'), async () => {
    expectCode(await gqlError(chairmanToken, SCAN, { d: { braname: ODN, code: `blago:shipment:${COOP}:${shipmentId}` } }), 'MARKETPLACE_SCAN_SHIPMENT_OTHER_BRANCH')
    expectCode(await gqlError(chairmanToken, SCAN, { d: { braname: ODN, code: box.code } }), 'MARKETPLACE_SCAN_CONTAINER_OTHER_BRANCH')
    expectCode(await gqlError(operatorToken, SCAN, { d: { braname: KRG, code: `blago:receive:othercoop:${ekaterina.account}` } }), 'MARKETPLACE_SCAN_CODE_WRONG_COOP')
    expectCode(await gqlError(operatorToken, SCAN, { d: { braname: KRG, code: `blago:return:${COOP}:${UNKNOWN_ID}` } }), 'MARKETPLACE_SCAN_RETURN_CLAIM_NOT_FOUND')
    expectCode(await gqlError(operatorToken, SCAN, { d: { braname: KRG, code: `blago:shipment:${COOP}:${UNKNOWN_ID}` } }), 'MARKETPLACE_SCAN_SHIPMENT_NOT_FOUND')
    expectCode(await gqlError(operatorToken, SCAN, { d: { braname: KRG, code: 'BX-9999999' } }), 'MARKETPLACE_CONTAINER_NOT_FOUND_BY_CODE')
    await gql(operatorToken, UPDATE_BOX, { d: { container_id: box.id, is_active: false } })
  })

  it(caseName('mkt.scan.side.04', 'визит запрашивает пайщик без прав оператора либо оператор чужого участка — отказ по правам'), async () => {
    denied(await gqlError(memberToken, SCAN, { d: { braname: KRG, code: ekaterina.account } }))
    denied(await gqlError(foreignToken, SCAN, { d: { braname: KRG, code: ekaterina.account } }))
  })
})
