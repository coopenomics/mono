/**
 * Стол заказов: подбор на выдаче — скан бокса и этикетки имущества
 * (test-registry/marketplace.issuance-pick.yaml, задача 99D-18).
 *
 * Оператор открыл выдачу пайщику и сканирует бокс или этикетку. Сервер
 * сверяет код с заказами окна выдачи: бокс — подсказка, где лежит имущество,
 * этикетка — подтверждение, что это оно. Запрос только читает склад.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, amount, caseName, gql, gqlError, tokenOf } from '../core'
import { KRG, issueOrder, pickOffer } from './flow'
import { fundShare } from './mkt-flows.helpers'
import { prepareReceivedOrder } from './issuance.helpers'

const PICK = `query($d:MarketplaceIssuancePickScanInput!){ marketplaceIssuancePickScan(data:$d){ target verdict inventory_id order_id quantity product_name container_code order_ids } }`
const INVENTORY = 'query($d:MarketplaceListInventoryInput){ marketplaceListInventory(data:$d){ id order_id barcode_value } }'
const CREATE_TYPE = 'mutation($d:MarketplaceCreateContainerTypeInput!){ marketplaceCreateContainerType(data:$d){ id } }'
const CREATE_BOXES = 'mutation($d:MarketplaceCreateContainersInput!){ marketplaceCreateContainers(data:$d){ id code braname } }'
const PLACE = 'mutation($d:MarketplaceAssignInventoryPlacementInput!){ marketplaceAssignInventoryPlacement(data:$d){ __typename } }'

const ODN = 'odn'

const ekaterina = ROLES.member()
const sidorov = ROLES.supplier()
const chairkrg = ROLES.branchChairman()
const chairodn = ROLES.foreignBranchChairman()

let operatorToken = ''
let chairmanToken = ''
let memberToken = ''
let foreignToken = ''
let orderA = ''
let orderB = ''
let labelA = ''
let labelB = ''
let labelIssued = ''
let boxWith = ''
let boxEmpty = ''

async function pick(token: string, braname: string, orderIds: string[], code: string): Promise<any> {
  return (await gql<any>(token, PICK, { d: { braname, order_ids: orderIds, code } })).marketplaceIssuancePickScan
}

async function itemOf(orderId: string): Promise<{ id: string, barcode_value: string }> {
  const list = (await gql<any>(operatorToken, INVENTORY, { d: { order_id: orderId } })).marketplaceListInventory as any[]
  const labeled = list.find(i => i.order_id === orderId && i.barcode_value)
  expect(labeled, `этикетка на позиции заказа ${orderId}`).toBeTruthy()
  return labeled
}

beforeAll(async () => {
  operatorToken = await tokenOf(chairkrg)
  chairmanToken = await tokenOf(CHAIRMAN)
  memberToken = await tokenOf(ekaterina)
  foreignToken = await tokenOf(chairodn)
  const offer = await pickOffer(sidorov.account, KRG, 'Мёд цветочный')
  const price = amount(offer.price_per_unit)
  await fundShare(ekaterina, price * 8)
  const prepare = async () => (await prepareReceivedOrder({
    member: ekaterina, supplier: sidorov, operator: chairkrg, offerId: offer.id, quantity: 1, receivedQuantity: 1, arrivalPrice: price,
  })).orderId
  // Заказ выдачи, второй заказ вне окна выдачи и заказ, который выдадут до скана.
  orderA = await prepare()
  orderB = await prepare()
  const issued = await prepare()
  const itemA = await itemOf(orderA)
  labelA = itemA.barcode_value
  labelB = (await itemOf(orderB)).barcode_value
  labelIssued = (await itemOf(issued)).barcode_value
  await issueOrder({ operator: chairkrg, member: ekaterina, orderId: issued, actualQuantity: 1, actualUnitPrice: price })

  const T = Date.now().toString(36).toUpperCase()
  const type = (await gql<any>(chairmanToken, CREATE_TYPE, { d: { name: `Подбор ${T}`, length_cm: 30, width_cm: 20, height_cm: 10, max_weight_kg: '5' } })).marketplaceCreateContainerType
  const boxes = (await gql<any>(operatorToken, CREATE_BOXES, { d: { braname: KRG, container_type_id: type.id, count: 2, label: `Подбор ${T}` } })).marketplaceCreateContainers as any[]
  boxWith = boxes[0].code
  boxEmpty = boxes[1].code
  await gql(operatorToken, PLACE, { d: { inventory_id: itemA.id, container_id: boxes[0].id } })
}, 1_500_000)

describe('Стол заказов — подбор на выдаче: этикетка', () => {
  it(caseName('mkt.pick.happy.01', 'этикетка имущества выдачи ведёт к заказу и количеству под этикеткой'), async () => {
    const r = await pick(operatorToken, KRG, [orderA], labelA)
    expect(r).toMatchObject({ target: 'LABEL', verdict: 'MATCH', order_id: orderA, quantity: 1 })
    expect(r.inventory_id).toBeTruthy()
    expect(r.product_name).toBeTruthy()
  })

  it(caseName('mkt.pick.break.01', 'этикетка имущества вне окна выдачи — «не то имущество»'), async () => {
    expect(await pick(operatorToken, KRG, [orderA], labelB)).toMatchObject({ target: 'LABEL', verdict: 'OTHER_ORDER', order_id: null })
  })

  it(caseName('mkt.pick.break.02', 'этикетка выданного имущества — числится вне склада'), async () => {
    expect(await pick(operatorToken, KRG, [orderA], labelIssued)).toMatchObject({ target: 'LABEL', verdict: 'NOT_ON_WAREHOUSE' })
  })

  it(caseName('mkt.pick.break.03', 'этикетка и бокс участка КРГ на выдаче участка ОДН — другой участок'), async () => {
    expect(await pick(chairmanToken, ODN, [orderA], labelA)).toMatchObject({ verdict: 'OTHER_BRANCH' })
    expect(await pick(chairmanToken, ODN, [orderA], boxWith)).toMatchObject({ target: 'CONTAINER', verdict: 'OTHER_BRANCH', container_code: boxWith })
  })
})

describe('Стол заказов — подбор на выдаче: бокс и права', () => {
  it(caseName('mkt.pick.happy.03', 'QR бокса и код с его этикетки называют заказы выдачи в боксе'), async () => {
    for (const code of [`container:${COOP}:${boxWith}`, boxWith.toLowerCase()]) {
      expect(await pick(operatorToken, KRG, [orderA, orderB], code)).toMatchObject({
        target: 'CONTAINER', verdict: 'MATCH', container_code: boxWith, order_ids: [orderA],
      })
    }
  })

  it(caseName('mkt.pick.side.01', 'бокс без имущества выдачи и неизвестный код — свой ответ, не ошибка'), async () => {
    expect(await pick(operatorToken, KRG, [orderA], boxEmpty)).toMatchObject({ target: 'CONTAINER', verdict: 'BOX_EMPTY', order_ids: [] })
    expect(await pick(operatorToken, KRG, [orderA], 'https://example.org')).toMatchObject({ target: null, verdict: 'UNKNOWN' })
  })

  it(caseName('mkt.pick.side.02', 'подбор запрашивает пайщик без прав оператора либо оператор чужого участка — отказ по правам'), async () => {
    for (const token of [memberToken, foreignToken]) {
      const err = await gqlError(token, PICK, { d: { braname: KRG, order_ids: [orderA], code: labelA } })
      expect(err, 'ожидался отказ по правам').not.toBeNull()
      expect(['403', 'KIT_INSUFFICIENT_RIGHTS', 'KIT_RIGHT_SCOPE_OWN_KU', 'MARKETPLACE_NOT_A_MEMBER']).toContain(String(err!.code))
    }
  })
})
