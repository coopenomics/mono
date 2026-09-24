/**
 * Выдача имущества пайщику (реестр marketplace.issuance, level backend) —
 * снаружи, через API стенда.
 *
 * Первый набор ведёт один заказ поставщика по всей выдаче с остановкой на
 * каждом этапе: заказано 4, привезли 3 по цене прибытия ниже цены заказа,
 * выдано 2 ещё дешевле. На каждом этапе проверяется, что чужой пайщик,
 * лишнее количество, цена выше потолка и подменённая подпись отбиваются
 * сервером, а итог закрытия — остаток кооперативу, уценка, счётчики
 * предложения — виден через API.
 *
 * Второй набор — бандл из двух заказов, в котором заявления подписаны не к
 * своим заказам: сбой одной позиции не прерывает остальные, бандл не
 * принимается, пока не поданы все.
 *
 * Решения совета по выдаче на стенде принимает робот (boot: robot-preset) —
 * поэтому акт к подписи приходит в ответе на подпись заявления.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, amount, caseName, ensureShareFunds, gql, gqlError, signDocument, tokenOf } from '../core'
import type { Who } from '../core'
import { SAGA_FIELDS, historyOfProcess, pickOffer, sagaOf } from './flow'
import {
  CLOSE,
  CREATE_BUNDLE,
  FINALIZE,
  SIGN_ACT,
  actPayload,
  aggregateAsInput,
  bundleInput,
  bundlePayloads,
  closeAggregate,
  createBundle,
  finalizeInput,
  inventoryOfOrder,
  money,
  offerCounters,
  prepareReceivedOrder,
  price2,
  signStatement,
  sumQty,
} from './issuance.helpers'
import type { OfferCounters, PreparedOrder } from './issuance.helpers'

const OFFER_NAME = 'Мёд цветочный'

const STATEMENT_PAYLOAD = `query($d:MarketplaceIssuanceOrderInput!){
  marketplaceIssuanceStatementPayload(data:$d){ full_title html hash meta binary }
}`
const SIGN_STATEMENT = `mutation($d:MarketplaceSignIssuanceStatementInput!){
  marketplaceSignIssuanceStatement(data:$d){ ${SAGA_FIELDS} }
}`
const FIX_FACT = `mutation($d:MarketplaceFixIssuanceFactInput!){
  marketplaceFixIssuanceFact(data:$d){ saga{ id stage } }
}`
const ACT_PAYLOAD = `query($d:MarketplaceIssuanceOrderInput!){
  marketplaceIssuanceActPayload(data:$d){ full_title html hash meta binary }
}`
const CLOSE_WITH_FACT = `mutation($d:MarketplaceSignIssuanceActInput!){
  marketplaceCloseIssuance(data:$d){ id order_id stage fact{ actual_quantity actual_unit_price fact_cost } }
}`

let member: Who
let stranger: Who
let supplier: Who
let operator: Who
let memberToken = ''
let strangerToken = ''
let operatorToken = ''
let chairmanToken = ''
let offer: { id: string, product_name: string, price_per_unit: string }
let orderPrice = 0

beforeAll(async () => {
  member = ROLES.member()
  stranger = ROLES.otherMember()
  supplier = ROLES.supplier()
  operator = ROLES.branchChairman()
  memberToken = await tokenOf(member)
  strangerToken = await tokenOf(stranger)
  operatorToken = await tokenOf(operator)
  chairmanToken = await tokenOf(CHAIRMAN)
  offer = await pickOffer(chairmanToken, supplier.account, undefined, OFFER_NAME)
  orderPrice = amount(offer.price_per_unit)
  // Три заказа файла (4 + 2 + 2 единицы) с запасом на членский взнос.
  await ensureShareFunds(member.account, orderPrice * 8 * 2, memberToken)
}, 300_000)

describe('выдача одного заказа по этапам: заказано 4, привезли 3, выдано 2', () => {
  const ORDERED = 4
  const RECEIVED = 3
  const ISSUED = 2
  let arrival = 0
  let issuePrice = 0
  let order: PreparedOrder
  let proposalId = ''
  let sagaId = ''
  let countersBefore: OfferCounters
  let countersAfter: OfferCounters
  let closingAct: any

  beforeAll(async () => {
    arrival = price2(orderPrice * 0.9)
    issuePrice = price2(orderPrice * 0.8)
    order = await prepareReceivedOrder({
      member,
      supplier,
      operator,
      offerId: offer.id,
      quantity: ORDERED,
      receivedQuantity: RECEIVED,
      arrivalPrice: arrival,
    })
  }, 300_000)

  it(caseName('mkt.iss.side.03', 'к выдаче больше принятого на склад — отказ, сага не рождается'), async () => {
    const err = await gqlError(operatorToken, CREATE_BUNDLE, bundleInput(member.account, [
      { order_id: order.orderId, actual_quantity: RECEIVED + 1, actual_unit_price: money(arrival) },
    ]))
    expect(err?.code, 'выдать больше принятого нельзя').toBe('MARKETPLACE_ISSUANCE_QUANTITY_EXCEEDS_RECEIVED')

    const fix = await gqlError(operatorToken, FIX_FACT, {
      d: { order_id: order.orderId, actual_quantity: RECEIVED + 1, actual_unit_price: money(arrival) },
    })
    expect(fix?.code, 'и отдельной фиксацией факта у стойки тоже').toBe('MARKETPLACE_ISSUANCE_QUANTITY_EXCEEDS_RECEIVED')

    expect(await sagaOf(memberToken, order.orderId), 'после отказа хода выдачи по заказу нет').toBeNull()
  })

  it(caseName('mkt.iss.side.48', 'цена выдачи выше цены прибытия — отказ; снижение принимается'), async () => {
    // Цена прибытия ниже цены заказа: потолок — именно цена прибытия.
    const between = price2((arrival + orderPrice) / 2)
    expect(between, 'между ценой прибытия и ценой заказа есть зазор').toBeGreaterThan(arrival)

    for (const price of [between, orderPrice]) {
      const err = await gqlError(operatorToken, CREATE_BUNDLE, bundleInput(member.account, [
        { order_id: order.orderId, actual_quantity: ISSUED, actual_unit_price: money(price) },
      ]))
      expect(err?.code, `цена ${price} выше цены прибытия ${arrival} — цену при выдаче можно только снизить`).toBe('MARKETPLACE_ISSUANCE_PRICE_ABOVE_CEILING')
    }
    expect(await sagaOf(memberToken, order.orderId), 'заявление не формируется, хода выдачи нет').toBeNull()

    proposalId = await createBundle(operatorToken, member.account, [
      { order_id: order.orderId, actual_quantity: ISSUED, actual_unit_price: money(issuePrice) },
    ])
    const saga = await sagaOf(memberToken, order.orderId)
    expect(saga?.stage, 'сниженная цена принята — ход выдачи начат').toBe('FACT_FIXED')
    sagaId = saga.id
  })

  it(caseName('mkt.iss.side.02', 'заявление по чужому заказу другой пайщик не получает и не подписывает'), async () => {
    const own = await gql<any>(memberToken, STATEMENT_PAYLOAD, { d: { order_id: order.orderId } })
    const statement = own.marketplaceIssuanceStatementPayload

    const read = await gqlError(strangerToken, STATEMENT_PAYLOAD, { d: { order_id: order.orderId } })
    expect(read?.code, 'заявление чужого заказа не выдаётся').toBe('MARKETPLACE_ORDER_FOREIGN_MEMBER')

    const signedByStranger = await signDocument(stranger.wif, statement, stranger.account, 1)
    const sign = await gqlError(strangerToken, SIGN_STATEMENT, { d: { order_id: order.orderId, signed_statement: signedByStranger } })
    expect(sign?.code, 'подпись чужого пайщика не двигает выдачу').toBe('MARKETPLACE_ORDER_FOREIGN_MEMBER')

    const bundle = await gqlError(strangerToken, FINALIZE, finalizeInput(proposalId, [{ order_hash: order.orderHash, signed_statement: signedByStranger }]))
    expect(bundle?.code, 'бандл подписывает только его адресат').toBe('MARKETPLACE_STOCK_PROPOSAL_NOT_ADDRESSEE')

    const saga = await sagaOf(memberToken, order.orderId)
    expect(saga.stage, 'на цепь ничего не ушло — ход выдачи на том же этапе').toBe('FACT_FIXED')
    expect(saga.decision_id, 'повестки совета нет').toBeNull()
  })

  it(caseName('mkt.iss.happy.40', 'робот совета решает у стойки — акт к подписи в ответе на подпись заявления'), async () => {
    const payloads = await bundlePayloads(memberToken, proposalId)
    expect(payloads.convert, 'факт не больше заказа — заявления на доплату нет').toBeNull()
    const statement = payloads.statements.get(order.orderHash)
    expect(statement, 'заявление по заказу бандла пришло к подписи').toBeTruthy()

    const d = await gql<any>(memberToken, FINALIZE, finalizeInput(proposalId, [
      { order_hash: order.orderHash, signed_statement: await signStatement(member, statement) },
    ]))
    const res = d.marketplaceFinalizeStockIssuance
    expect(res.proposal.status).toBe('ACCEPTED')
    const saga = res.sagas.find((s: any) => s.order_id === order.orderId)
    expect(saga.id, 'ход выдачи тот же, что начат у стойки').toBe(sagaId)
    expect(saga.decision_id, 'номер решения совета дочитан').toBeTruthy()
    expect(saga.decision_mode, 'решение принял робот').toBe('ROBOT')
    expect(saga.stage, 'обратный вызов совета довёл выдачу до акта в том же ответе').toBe('DECISION_AUTHORIZED')
    expect(saga.awaits_member_signature, 'пайщик сразу подписывает акт').toBe(true)

    const act = await actPayload(memberToken, order.orderId)
    expect(act.hash, 'акт к подписи отдаётся без второго нажатия').toBeTruthy()
  })

  it(caseName('mkt.iss.side.06', 'акт по чужому заказу — отказ доступа, выдача не двигается'), async () => {
    const act = await actPayload(memberToken, order.orderId)

    const read = await gqlError(strangerToken, ACT_PAYLOAD, { d: { order_id: order.orderId } })
    expect(read?.code, 'акт чужого заказа не выдаётся').toBe('MARKETPLACE_ORDER_FOREIGN_MEMBER')

    const signed = await signDocument(stranger.wif, act, stranger.account, 1)
    const sign = await gqlError(strangerToken, SIGN_ACT, { d: { order_id: order.orderId, signed_act: signed } })
    expect(sign?.code, 'акт не адресован этому пайщику').toBe('MARKETPLACE_ORDER_FOREIGN_MEMBER')

    expect((await sagaOf(memberToken, order.orderId)).stage, 'на цепь ничего не ушло').toBe('DECISION_AUTHORIZED')
  })

  it(caseName('mkt.iss.side.05', 'повторная фиксация факта по заказу, выдача которого идёт, — отказ, вторая сага не рождается'), async () => {
    const fix = await gqlError(operatorToken, FIX_FACT, {
      d: { order_id: order.orderId, actual_quantity: 1, actual_unit_price: money(issuePrice) },
    })
    expect(fix?.code, 'заказ уже в выдаче — факт заново не фиксируется').toBe('MARKETPLACE_ISSUANCE_WRONG_ORDER_STATUS')

    const bundle = await gqlError(operatorToken, CREATE_BUNDLE, bundleInput(member.account, [
      { order_id: order.orderId, actual_quantity: 1, actual_unit_price: money(issuePrice) },
    ]))
    expect(bundle?.code, 'и в новый бандл заказ не берётся').toBe('MARKETPLACE_STOCK_PROPOSAL_ORDER_NOT_READY')

    const saga = await sagaOf(memberToken, order.orderId)
    expect(saga.id, 'ход выдачи прежний').toBe(sagaId)
    expect(saga.stage).toBe('DECISION_AUTHORIZED')
  })

  it(caseName('mkt.iss.side.43', 'закрывающий акт без подписи заказчика, с подменённой или без подписи оператора — отказ'), async () => {
    const act = await actPayload(memberToken, order.orderId)
    const signed = await gql<any>(memberToken, SIGN_ACT, { d: { order_id: order.orderId, signed_act: await signDocument(member.wif, act, member.account, 1) } })
    expect(signed.marketplaceSignIssuanceAct.stage, 'заказчик подписал акт — ход за оператором').toBe('ACT1_SIGNED')

    const agg = await closeAggregate(operatorToken, order.orderId)

    // Оператор подписал акт первой подписью, мимо подписи заказчика.
    const withoutMember = await signDocument(operator.wif, agg.rawDocument, operator.account, 1)
    const lost = await gqlError(operatorToken, CLOSE, { d: { order_id: order.orderId, signed_act: withoutMember } })
    expect(lost?.code, 'подпись заказчика утеряна').toBe('MARKETPLACE_ACT_CUSTOMER_SIGNATURE_LOST')

    // Подпись заказчика подменена подписью оператора.
    const proper = await signDocument(operator.wif, agg.rawDocument, operator.account, 2, [agg.document])
    const forged = {
      ...proper,
      signatures: proper.signatures.map((s: any) => (s.signer === member.account
        ? { ...s, signature: proper.signatures.find((o: any) => o.signer === operator.account).signature }
        : s)),
    }
    const replaced = await gqlError(operatorToken, CLOSE, { d: { order_id: order.orderId, signed_act: forged } })
    expect(replaced?.code, 'подпись заказчика подменена').toBe('MARKETPLACE_ACT_CUSTOMER_SIGNATURE_LOST')

    // Акт заказчика как есть — закрывающей подписи нет.
    const noOperator = await gqlError(operatorToken, CLOSE, { d: { order_id: order.orderId, signed_act: aggregateAsInput(agg.document) } })
    expect(noOperator?.code, 'без своей подписи оператор выдачу не закрывает').toBe('MARKETPLACE_ACT_CLOSE_WRONG_OPERATOR')

    expect((await sagaOf(memberToken, order.orderId)).stage, 'выдача не закрыта').toBe('ACT1_SIGNED')
  })

  it(caseName('mkt.iss.side.04', 'заказчик забрал не всё — невыданное уходит в остаток кооператива, к оплате только выданное'), async () => {
    countersBefore = await offerCounters(chairmanToken, offer.id)
    const agg = await closeAggregate(operatorToken, order.orderId)
    closingAct = await signDocument(operator.wif, agg.rawDocument, operator.account, 2, [agg.document])
    const d = await gql<any>(operatorToken, CLOSE_WITH_FACT, { d: { order_id: order.orderId, signed_act: closingAct } })
    countersAfter = await offerCounters(chairmanToken, offer.id)
    const closed = d.marketplaceCloseIssuance
    expect(closed.stage).toBe('CLOSED')
    expect(Number(closed.fact.actual_quantity)).toBe(ISSUED)
    expect(amount(closed.fact.fact_cost), 'к оплате — только выданное по цене выдачи').toBeCloseTo(ISSUED * issuePrice, 4)

    const rows = await inventoryOfOrder(operatorToken, order.orderId)
    expect(sumQty(rows, r => r.status === 'ISSUED'), 'выдано ровно зафиксированное').toBe(ISSUED)
    expect(sumQty(rows, r => r.ownership === 'COOP' && r.status !== 'ISSUED'), 'невыданное — в обезличенном остатке кооператива').toBe(RECEIVED - ISSUED)
    expect(sumQty(rows, r => r.ownership === 'ORDER' && r.status !== 'ISSUED'), 'за заказчиком на складе ничего не осталось').toBe(0)
  })

  it(caseName('mkt.iss.side.45', 'заказ поставщика: выбывает принятое кооперативом, недопоставка возвращается в свободное'), async () => {
    expect(countersAfter, 'закрытие выдачи прошло').toBeTruthy()
    expect(countersAfter.consumed - countersBefore.consumed, 'из предложения выбывает принятое кооперативом').toBeCloseTo(RECEIVED, 6)
    expect(countersAfter.available - countersBefore.available, 'непривезённое возвращается поставщику в свободное').toBeCloseTo(ORDERED - RECEIVED, 6)
    expect(countersBefore.blocked - countersAfter.blocked, 'заблокированное заказом снято целиком').toBeCloseTo(ORDERED, 6)
  })

  it(caseName('mkt.iss.side.49', 'выдано дешевле цены прибытия — разница по выданному уходит уценкой'), async () => {
    const rows = await historyOfProcess(chairmanToken, order.orderHash)
    const loss = rows.filter(r => r.action === 'apply' && r.operationCode === 'o.mkt.loss')
    const total = loss.reduce((s, r) => s + amount(r.quantity), 0)
    expect(total, 'уценка — стоимость прибытия выданного минус сумма выдачи').toBeCloseTo(ISSUED * (arrival - issuePrice), 2)
  })

  it('DIAG повтор закрытия и чтение хода выдачи после закрытия', async () => {
    const agg = { order_id: order.orderId }
    const again = await gqlError(operatorToken, CLOSE, { d: { ...agg, signed_act: closingAct } })
    console.log('DIAG close-again', JSON.stringify(again))
    const saga = await gqlError(memberToken, `query($d:MarketplaceIssuanceOrderInput!){ marketplaceIssuanceSaga(data:$d){ id stage } }`, { d: agg })
    const read = await gql<any>(memberToken, `query($d:MarketplaceIssuanceOrderInput!){ marketplaceIssuanceSaga(data:$d){ id stage } }`, { d: agg }).catch(e => String(e))
    console.log('DIAG saga-after-close', JSON.stringify(saga), JSON.stringify(read))
    const list = await gql<any>(memberToken, `query($d:MarketplaceListIssuanceSagasInput){ marketplaceListIssuanceSagas(data:$d){ id order_id stage } }`, { d: { active_only: false } })
    console.log('DIAG list', JSON.stringify(list.marketplaceListIssuanceSagas.filter((s: any) => s.order_id === order.orderId)))
  })
})

describe('бандл из двух заказов: сбой позиции не прерывает остальные', () => {
  let b1: PreparedOrder
  let b2: PreparedOrder
  let proposalId = ''
  const statements = new Map<string, any>()

  beforeAll(async () => {
    b1 = await prepareReceivedOrder({ member, supplier, operator, offerId: offer.id, quantity: 2, receivedQuantity: 2, arrivalPrice: orderPrice })
    b2 = await prepareReceivedOrder({ member, supplier, operator, offerId: offer.id, quantity: 2, receivedQuantity: 2, arrivalPrice: orderPrice })
    proposalId = await createBundle(operatorToken, member.account, [
      { order_id: b1.orderId, actual_quantity: 2, actual_unit_price: money(orderPrice) },
      { order_id: b2.orderId, actual_quantity: 2, actual_unit_price: money(orderPrice) },
    ])
    const p = await bundlePayloads(memberToken, proposalId)
    statements.set(b1.orderHash, await signStatement(member, p.statements.get(b1.orderHash)))
    statements.set(b2.orderHash, await signStatement(member, p.statements.get(b2.orderHash)))
  }, 600_000)

  it(caseName('mkt.iss.side.54', 'несколько позиций не приняты — одна ошибка после всех с числом и названиями, бандл не принят'), async () => {
    // Заявления перепутаны местами: каждое подписано к чужому заказу.
    const err = await gqlError(memberToken, FINALIZE, finalizeInput(proposalId, [
      { order_hash: b1.orderHash, signed_statement: statements.get(b2.orderHash) },
      { order_hash: b2.orderHash, signed_statement: statements.get(b1.orderHash) },
    ]))
    expect(err?.code, 'по нескольким сбоям — одна сводная ошибка').toBe('MARKETPLACE_STOCK_PROPOSAL_PARTIAL_SUBMIT_FAILURE')
    expect(err?.message, 'в ошибке — число несостоявшихся позиций').toContain('2')
    expect(err?.message, 'и их названия').toContain(offer.product_name)
    for (const o of [b1, b2])
      expect((await sagaOf(memberToken, o.orderId)).stage, 'ни одно заявление не ушло').toBe('FACT_FIXED')
  })

  it(caseName('mkt.iss.side.54', 'сбой первой позиции не прерывает вторую; бандл принимается, когда поданы все, саги в порядке бандла'), async () => {
    const err = await gqlError(memberToken, FINALIZE, finalizeInput(proposalId, [
      { order_hash: b1.orderHash, signed_statement: statements.get(b2.orderHash) },
      { order_hash: b2.orderHash, signed_statement: statements.get(b2.orderHash) },
    ]))
    expect(err?.code, 'одна несостоявшаяся позиция — её собственная ошибка').toBe('MARKETPLACE_STATEMENT_WRONG_ORDER')
    expect((await sagaOf(memberToken, b1.orderId)).stage, 'позиция со сбоем не подана').toBe('FACT_FIXED')
    expect((await sagaOf(memberToken, b2.orderId)).stage, 'вторая позиция подана, хотя первая упала').not.toBe('FACT_FIXED')

    // Бандл не принят: повторная подпись того же бандла возможна.
    const d = await gql<any>(memberToken, FINALIZE, finalizeInput(proposalId, [
      { order_hash: b1.orderHash, signed_statement: statements.get(b1.orderHash) },
      { order_hash: b2.orderHash, signed_statement: statements.get(b2.orderHash) },
    ]))
    const res = d.marketplaceFinalizeStockIssuance
    expect(res.proposal.status, 'поданы все — бандл принят').toBe('ACCEPTED')
    expect(res.order_ids, 'заказы — в порядке бандла').toEqual([b1.orderId, b2.orderId])
    expect(res.sagas.map((s: any) => s.order_id), 'саги — в порядке бандла').toEqual([b1.orderId, b2.orderId])
  })

  it(caseName('mkt.iss.side.49', 'выдача по цене прибытия — уценки нет'), async () => {
    for (const o of [b1, b2]) {
      const act = await actPayload(memberToken, o.orderId)
      await gql(memberToken, SIGN_ACT, { d: { order_id: o.orderId, signed_act: await signDocument(member.wif, act, member.account, 1) } })
      const agg = await closeAggregate(operatorToken, o.orderId)
      const d = await gql<any>(operatorToken, CLOSE, {
        d: { order_id: o.orderId, signed_act: await signDocument(operator.wif, agg.rawDocument, operator.account, 2, [agg.document]) },
      })
      expect(d.marketplaceCloseIssuance.stage).toBe('CLOSED')
      const rows = await historyOfProcess(chairmanToken, o.orderHash)
      expect(rows.filter(r => r.operationCode === 'o.mkt.loss'), 'цена выдачи равна цене прибытия — уценки нет').toEqual([])
    }
  })
})
