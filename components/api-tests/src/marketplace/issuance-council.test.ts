/**
 * Выдача заказа, когда решение совета принимают люди, а не робот
 * (test-registry/marketplace.issuance.yaml, soviet.robot.yaml).
 *
 * Предустановка стенда отдаёт решения о выдаче роботу — весь путь проходит у
 * стойки без людей. Здесь робот по выдаче не голосует: заявление ложится в
 * повестку и ждёт совет. Проверяется спокойное ожидание пайщика, отказ
 * оператору снять выдачу во время рассмотрения, продолжение после решения
 * совета и закрытие выдачи отказом совета.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import {
  CHAIRMAN,
  ROLES,
  amount,
  authorizeDecisionOnChain,
  automateCouncil,
  availableShare,
  caseName,
  declineDecisionOnChain,
  ensureShareFunds,
  gql,
  gqlError,
  presetDecisionTypes,
  restoreRobotPreset,
  tokenOf,
  voteOnDecision,
  waitFor,
} from '../core'
import { SAGA_FIELDS, getOrder, pickOffer, sagaOf } from './flow'
import {
  FINALIZE,
  actPayload,
  bundlePayloads,
  createBundle,
  finalizeInput,
  money,
  prepareReceivedOrder,
  price2,
  signStatement,
} from './issuance.helpers'
import type { PreparedOrder } from './issuance.helpers'

const OFFER_NAME = 'Мёд цветочный'
const ISSUANCE_DECISION = 'mktissue'
const CANCEL = `mutation($d:MarketplaceIssuanceOrderInput!){ marketplaceCancelIssuance(data:$d){ ${SAGA_FIELDS} } }`

let member: Who
let supplier: Who
let operator: Who
let memberToken = ''
let operatorToken = ''
let offer: { id: string, product_name: string, price_per_unit: string }
let arrival = 0

/** Заказ принят на склад, факт выдачи зафиксирован, заявление подписано пайщиком. */
async function statementOnAgenda(): Promise<{ order: PreparedOrder, saga: any }> {
  const order = await prepareReceivedOrder({ member, supplier, operator, offerId: offer.id, quantity: 1, receivedQuantity: 1, arrivalPrice: arrival })
  const proposalId = await createBundle(operatorToken, member.account, [
    { order_id: order.orderId, actual_quantity: 1, actual_unit_price: money(arrival) },
  ])
  const payloads = await bundlePayloads(memberToken, proposalId)
  const d = await gql<any>(memberToken, FINALIZE, finalizeInput(proposalId, [
    { order_hash: order.orderHash, signed_statement: await signStatement(member, payloads.statements.get(order.orderHash)) },
  ]))
  const saga = d.marketplaceFinalizeStockIssuance.sagas.find((s: any) => s.order_id === order.orderId)
  return { order, saga }
}

async function sagaAt(orderId: string, stage: string, label: string): Promise<any> {
  return waitFor(async () => {
    const saga = await sagaOf(memberToken, orderId)
    return saga?.stage === stage ? saga : null
  }, { timeoutMs: 120_000, intervalMs: 1_000, label })
}

describe('выдача по решению людей: робот по выдаче не голосует', () => {
  beforeAll(async () => {
    member = ROLES.member()
    supplier = ROLES.supplier()
    operator = ROLES.branchChairman()
    memberToken = await tokenOf(member)
    operatorToken = await tokenOf(operator)
    offer = await pickOffer(supplier.account, undefined, OFFER_NAME)
    const orderPrice = amount(offer.price_per_unit)
    arrival = price2(orderPrice * 0.9)
    await ensureShareFunds(member.account, orderPrice * 4, memberToken)
    // Совет решает выдачу сам: остальные решения предустановки остаются у робота.
    await automateCouncil(presetDecisionTypes().filter(type => type !== ISSUANCE_DECISION))
  }, 300_000)

  afterAll(async () => {
    await restoreRobotPreset()
  })

  it(caseName('mkt.iss.side.40', 'робот ответил «вручную» — выдача спокойно ждёт совет; после решения людей акт формируется и ждёт подписи пайщика'), async () => {
    const { order, saga } = await statementOnAgenda()
    // sov.rob.side.91: инициатор получает ответ сразу и у стойки не ждёт.
    expect(saga.stage).toBe('DECISION_PENDING')
    expect(saga.decision_mode).toBe('MANUAL')
    expect(saga.awaits_council).toBe(true)
    expect(saga.awaits_member_signature, 'подписывать пайщику пока нечего').toBe(false)
    expect(saga.decision_id, 'заявление в повестке совета').toBeTruthy()

    // mkt.iss.side.42: пока совет рассматривает заявление, выдачу снять нельзя.
    const cancel = await gqlError(operatorToken, CANCEL, { d: { order_id: order.orderId } })
    expect(cancel, 'снятие выдачи во время рассмотрения отклонено').not.toBeNull()
    expect((await sagaOf(memberToken, order.orderId)).stage).toBe('DECISION_PENDING')

    // Решение людей приходит обратным вызовом совета.
    const decisionId = Number(saga.decision_id)
    await voteOnDecision(decisionId, 'for')
    await authorizeDecisionOnChain(decisionId)
    const decided = await sagaAt(order.orderId, 'DECISION_AUTHORIZED', 'выдача продолжена после решения совета')
    expect(decided.awaits_member_signature).toBe(true)
    expect(decided.awaits_council).toBe(false)
    expect((await actPayload(memberToken, order.orderId)).hash, 'акт к подписи сформирован').toBeTruthy()
  })

  it(caseName('mkt.iss.side.41', 'совет отказал по заявлению — выдача закрыта отказом, заказ снова готов к выдаче, паевой не двигался'), async () => {
    const { order, saga } = await statementOnAgenda()
    expect(saga.stage).toBe('DECISION_PENDING')
    const chairmanToken = await tokenOf(CHAIRMAN)
    expect((await getOrder(chairmanToken, order.orderId)).status, 'пока совет рассматривает, заказ ждёт решения').toBe('ISSUE_PENDING')
    const shareBefore = await availableShare(member.account)

    const decisionId = Number(saga.decision_id)
    await voteOnDecision(decisionId, 'against')
    await declineDecisionOnChain(decisionId)

    const declined = await sagaAt(order.orderId, 'DECLINED', 'выдача закрыта отказом совета')
    expect(declined.awaits_member_signature).toBe(false)
    expect(declined.awaits_council).toBe(false)
    expect((await getOrder(chairmanToken, order.orderId)).status, 'заказ снова готов к выдаче').toBe('READY_TO_RECEIVE')
    expect(await availableShare(member.account), 'движений по паевому нет').toBeCloseTo(shareBefore, 4)
  })
})
