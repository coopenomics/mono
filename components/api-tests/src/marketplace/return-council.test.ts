/**
 * Гарантийный возврат, когда решение совета принимают люди
 * (test-registry/marketplace.return.yaml, mkt.ret.side.41).
 *
 * Предустановка стенда отдаёт решения о возврате роботу. Здесь робот по
 * возврату не голосует: заявление оператора ложится в повестку и ждёт совет.
 * Пока совет рассматривает, имущество лежит на участке и обратно не выдаётся;
 * после отказа совета оператор выдаёт его пайщику обратно, заявление
 * закрывается без движений по средствам.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import {
  ROLES,
  automateCouncil,
  availableShare,
  caseName,
  declineDecisionOnChain,
  gql,
  presetDecisionTypes,
  restoreRobotPreset,
  tokenOf,
  voteOnDecision,
  waitFor,
} from '../core'
import { KRG, pickOffer } from './flow'
import { fundShare, issuedOrder, refusal } from './mkt-flows.helpers'
import { warrantyReturn } from './writeoff.helpers'

const RETURN_DECISION = 'mktretrn'
const CLAIM = 'query($c:String!){ marketplaceReturnClaim(claim_id:$c){ id status order_id council_decision_id council_decision_mode decision_log{ decision } } }'
const HAND_BACK = 'mutation($d:MarketplaceHandBackReturnInput!){ marketplaceHandBackReturn(data:$d){ claim{ id status } } }'

let member: Who
let supplier: Who
let operator: Who
let memberToken = ''
let operatorToken = ''
let foreignOperatorToken = ''
let orderId = ''

async function claimById(claimId: string): Promise<any> {
  return (await gql<any>(operatorToken, CLAIM, { c: claimId })).marketplaceReturnClaim
}

describe('возврат по решению людей: совет отказал — имущество выдаётся обратно', () => {
  beforeAll(async () => {
    member = ROLES.member()
    supplier = ROLES.supplier()
    operator = ROLES.branchChairman()
    memberToken = await tokenOf(member)
    operatorToken = await tokenOf(operator)
    foreignOperatorToken = await tokenOf(ROLES.foreignBranchChairman())
    const offer = await pickOffer(supplier.account, KRG, 'Мёд цветочный')
    await fundShare(member, Number.parseFloat(offer.price_per_unit) * 3)
    orderId = (await issuedOrder({ member, supplier, operator, offer, quantity: 1 })).orderId
    // Совет решает возврат сам: остальные решения предустановки остаются у робота.
    await automateCouncil(presetDecisionTypes().filter(type => type !== RETURN_DECISION))
  }, 900_000)

  afterAll(async () => {
    await restoreRobotPreset()
  })

  it(caseName('mkt.ret.side.41', 'пока совет рассматривает, обратно не выдать; совет отказал — оператор выдаёт имущество обратно, паевой не двигался'), async () => {
    const shareBefore = await availableShare(member.account)
    const { claimId, status } = await warrantyReturn({ member, operator, orderId, quantity: 1 })
    expect(status, 'заявление оператора ждёт совет').toBe('PENDING_COUNCIL')

    const pending = await claimById(claimId)
    expect(pending.council_decision_id, 'заявление в повестке совета').toBeTruthy()
    const early = await refusal(operatorToken, HAND_BACK, { d: { claim_id: claimId, braname: KRG } })
    expect(early?.codeText, early?.message).toBe('MARKETPLACE_RETURN_CLAIM_COUNCIL_STILL_REVIEWING')

    const decisionId = Number(pending.council_decision_id)
    await voteOnDecision(decisionId, 'against')
    await declineDecisionOnChain(decisionId)
    await waitFor(async () => (await claimById(claimId)).status === 'DECLINED_BY_COUNCIL' ? true : null,
      { timeoutMs: 120_000, intervalMs: 1_000, label: 'заявление закрыто отказом совета' })

    // Оператор чужого участка обратно не выдаёт.
    const foreign = await refusal(foreignOperatorToken, HAND_BACK, { d: { claim_id: claimId, braname: KRG } })
    expect(foreign, 'чужой участок').not.toBeNull()
    expect((await claimById(claimId)).status).toBe('DECLINED_BY_COUNCIL')

    const back = await gql<any>(operatorToken, HAND_BACK, { d: { claim_id: claimId, braname: KRG } })
    expect(back.marketplaceHandBackReturn.claim.status).toBe('HANDED_BACK')
    const closed = await claimById(claimId)
    expect(closed.status).toBe('HANDED_BACK')
    expect(closed.decision_log.map((e: any) => e.decision)).toContain('hand_back')

    const again = await refusal(operatorToken, HAND_BACK, { d: { claim_id: claimId, braname: KRG } })
    expect(again?.codeText, again?.message).toBe('MARKETPLACE_RETURN_CLAIM_ISSUE_BACK_INVALID_STATUS')
    expect(await availableShare(member.account), 'движений по паевому нет').toBeCloseTo(shareBefore, 4)
  }, 600_000)
})
