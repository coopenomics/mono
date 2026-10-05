/**
 * Стол заказов: поставщик формирует партии поставки из акцептованных заказов
 * (test-registry/marketplace.shipment.yaml).
 *
 * Партия — то, что поставщик везёт на один участок одним способом: сам или
 * с экспедитором по накладной. Состав партии сверяется с акцептованными
 * заказами заявки; несовпадение — отказ, заказы остаются ждать. Партию можно
 * собрать из части заказов, остальные доедут следующей.
 *
 * Мир теста: два заказа пайщика у поставщика, оба акцептованы.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ROLES, amount, caseName, gql, tokenOf } from '../core'
import { KRG, pickOffer, placeOrder } from './flow'
import { fundShare, refusal } from './mkt-flows.helpers'

const SHIPMENT = 'id coopname cycle_id braname offerer_account delivery_variant status total_amount ttn_number ttn_document_id ttn_data{ vehicle_number expeditor_full_name }'
const CREATE = `mutation($d:MarketplaceCreateShipmentInput!){ marketplaceCreateShipment(data:$d){ shipments{ ${SHIPMENT} } } }`
const GET = `query($d:MarketplaceGetShipmentInput!){ marketplaceGetShipment(data:$d){ ${SHIPMENT} } }`
const LIST = `query($d:MarketplaceListShipmentsInput){ marketplaceListShipments(data:$d){ ${SHIPMENT} } }`
const ORDER = 'query($i:MarketplaceGetOrderInput!){ marketplaceGetOrder(input:$i){ id status cycle_id shipment_id } }'
const ACCEPT = 'mutation($i:MarketplaceAcceptOrdersBatchInput!){ marketplaceAcceptOrdersBatch(input:$i){ __typename } }'

const ODN = 'odn'
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const QTY = 1

const member = ROLES.member()
const supplier = ROLES.supplier()

let memberToken = ''
let supplierToken = ''
let price = 0
let first: any
let second: any

async function order(id: string): Promise<any> {
  return (await gql<any>(memberToken, ORDER, { i: { order_id: id } })).marketplaceGetOrder
}

async function acceptedOrder(offerId: string): Promise<any> {
  const placed = await placeOrder({ who: member, offerId, quantity: QTY })
  await gql(supplierToken, ACCEPT, { i: { order_ids: [placed.orderId] } })
  const accepted = await order(placed.orderId)
  expect(accepted.status, 'заказ акцептован поставщиком').toBe('ACCEPTED')
  expect(accepted.cycle_id, 'акцептованный заказ вошёл в заявку поставщику').toBeTruthy()
  return accepted
}

beforeAll(async () => {
  memberToken = await tokenOf(member)
  supplierToken = await tokenOf(supplier)
  const offer = await pickOffer(supplier.account, KRG, 'Мёд цветочный')
  price = amount(offer.price_per_unit)
  await fundShare(member, QTY * price * 4)
  first = await acceptedOrder(offer.id)
  second = await acceptedOrder(offer.id)
}, 600_000)

describe('Стол заказов — партии поставки', () => {
  it(caseName('mkt.ship.side.01', 'состав партии не сходится с заявкой — отказ, заказ ждёт дальше'), async () => {
    const foreignBranch = await refusal(supplierToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [{ braname: ODN, delivery_variant: 'SELF' }] } })
    expect(foreignBranch?.codeText, foreignBranch?.message).toBe('MARKETPLACE_SHIPMENT_COMPOSITION_MISMATCH')

    const foreignOrder = await refusal(supplierToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [{ braname: KRG, delivery_variant: 'SELF', order_ids: [UNKNOWN_ID] }] } })
    expect(foreignOrder?.codeText, foreignOrder?.message).toBe('MARKETPLACE_SHIPMENT_COMPOSITION_MISMATCH')

    const after = await order(first.id)
    expect(after.status).toBe('ACCEPTED')
    expect(after.shipment_id ?? null, 'партия не заведена').toBeNull()
  })

  it(caseName('mkt.ship.side.02', 'партия без групп доставки и по заявке, которой нет, — отказ своим кодом'), async () => {
    const empty = await refusal(supplierToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [] } })
    expect(empty?.codeText, empty?.message).toBe('MARKETPLACE_SHIPMENT_NO_DELIVERY_GROUPS')
    const ghost = await refusal(supplierToken, CREATE, { d: { cycle_id: UNKNOWN_ID, groups: [{ braname: KRG, delivery_variant: 'SELF' }] } })
    expect(ghost?.codeText, ghost?.message).toBe('MARKETPLACE_SHIPMENT_CYCLE_NOT_FOUND')
  })

  it(caseName('mkt.ship.side.03', 'партию по чужой заявке пайщик-не-поставщик не формирует'), async () => {
    const denied = await refusal(memberToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [{ braname: KRG, delivery_variant: 'SELF' }] } })
    expect(['403', 'KIT_RIGHT_SCOPE_OWN', 'MARKETPLACE_SHIPMENT_NOT_SUPPLIER'], denied?.message).toContain(denied?.codeText)
    expect((await order(first.id)).shipment_id ?? null).toBeNull()
  })

  it(caseName('mkt.ship.happy.01', 'поставщик везёт сам: партия собрана из выбранного заказа, сумма партии — сумма заказа, заказ привязан к партии'), async () => {
    const d = await gql<any>(supplierToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [{ braname: KRG, delivery_variant: 'SELF', order_ids: [first.id] }] } })
    const shipments = d.marketplaceCreateShipment.shipments as any[]
    expect(shipments).toHaveLength(1)
    const shipment = shipments[0]
    expect(shipment).toMatchObject({
      cycle_id: first.cycle_id,
      braname: KRG,
      offerer_account: supplier.account,
      delivery_variant: 'SELF',
      status: 'SUPPLY_PREPARED',
      ttn_number: null,
      ttn_document_id: null,
    })
    expect(amount(shipment.total_amount)).toBeCloseTo(QTY * price, 4)

    expect((await order(first.id)).shipment_id).toBe(shipment.id)
    const stored = (await gql<any>(supplierToken, GET, { d: { shipment_id: shipment.id } })).marketplaceGetShipment
    expect(stored).toMatchObject({ id: shipment.id, status: 'SUPPLY_PREPARED' })
    const listed = (await gql<any>(supplierToken, LIST, { d: { cycle_id: first.cycle_id } })).marketplaceListShipments
    expect(listed.map((s: any) => s.id)).toContain(shipment.id)
  })

  it(caseName('mkt.ship.side.04', 'заказ, уже уехавший партией, во вторую партию не попадает'), async () => {
    const before = (await order(first.id)).shipment_id
    const again = await refusal(supplierToken, CREATE, { d: { cycle_id: first.cycle_id, groups: [{ braname: KRG, delivery_variant: 'SELF', order_ids: [first.id] }] } })
    expect(['MARKETPLACE_SHIPMENT_COMPOSITION_MISMATCH', 'MARKETPLACE_SHIPMENT_COMPOSITION_CYCLE_NOT_ACCEPTED'], again?.message).toContain(again?.codeText)
    expect((await order(first.id)).shipment_id, 'заказ остался в первой партии').toBe(before)
  })

  it(caseName('mkt.ship.happy.02', 'поставщик отправляет с экспедитором: партии присвоен номер накладной, данные перевозки сохранены'), async () => {
    const d = await gql<any>(supplierToken, CREATE, {
      d: {
        cycle_id: second.cycle_id,
        groups: [{
          braname: KRG,
          delivery_variant: 'EXPEDITOR',
          order_ids: [second.id],
          ttn_data: { vehicle_number: 'А123ВС77', expeditor_full_name: 'Перевозчиков Пётр', expeditor_phone: '+79990000000' },
        }],
      },
    })
    const shipment = d.marketplaceCreateShipment.shipments[0]
    expect(shipment).toMatchObject({ braname: KRG, delivery_variant: 'EXPEDITOR', status: 'SUPPLY_PREPARED' })
    expect(shipment.ttn_number, 'номер накладной присвоен').toBeTruthy()
    expect(shipment.ttn_data).toMatchObject({ vehicle_number: 'А123ВС77', expeditor_full_name: 'Перевозчиков Пётр' })
    expect((await order(second.id)).shipment_id).toBe(shipment.id)
  })
})
