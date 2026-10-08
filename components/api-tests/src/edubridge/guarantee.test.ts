/**
 * Гарантийные условия программы «Образование» снаружи
 * (test-registry/edubridge.enrollment.yaml).
 *
 * Пока идёт гарантийный срок, участник подаёт обоснованное заявление об
 * аннулировании подписки; его рассматривает совет (п. 4.4.2–4.4.4 Положения
 * ЦПП). Совет удовлетворил — подписка закрыта, вся стоимость возвращена на
 * главный паевой. Совет отклонил — заявление закрыто, подписка действует, и
 * участнику остаётся обычный отказ. Пока заявление на рассмотрении, обычный
 * отказ закрыт: два возврата по одной подписке невозможны.
 *
 * Курсы идут третий день: обычный отказ вернул бы половину стоимости на
 * кошелёк программы — тем виднее разница с возвратом по гарантии.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, signDocument, tokenOf, waitFor } from '../core'
import {
  CANCEL_ENROLLMENT,
  GUARANTEE_STATEMENT,
  PROGRAM_WALLET,
  SHARE_WALLET,
  SUBMIT_GUARANTEE,
  addLearner,
  councilDeclines,
  councilGrants,
  createSection,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  guaranteeAgenda,
  guaranteeOf,
  publishCourse,
  signOffer,
  submitGuaranteeClaim,
  subscribe,
  walletOf,
} from './edubridge.helpers'

const UNDER_REVIEW = 'EDUBRIDGE_SUBSCRIPTION_GUARANTEE_UNDER_REVIEW'

describe('Образование: аннулирование подписки по гарантийным условиям', () => {
  let learner: Who
  let token = ''
  let stranger: Who
  let strangerToken = ''
  let fee = 0
  /** Подписка, заявление по которой совет удовлетворит. */
  let granted: any
  /** Подписка, заявление по которой совет отклонит. */
  let declined: any
  /** Подписка на курс без гарантийного срока. */
  let bare: any
  let late: any

  const wallet = (name: string) => walletOf(token, learner.account, name)
  const claimOf = async (enrollmentId: string) => (await guaranteeOf(token, enrollmentId))?.claim ?? null
  const statementInput = (enrollmentId: string, reason = 'Занятия не соответствуют программе курса') => ({ d: { enrollment_id: enrollmentId, reason, links: [] } })

  beforeAll(async () => {
    await educationOn()
    const chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    const courseA = await publishCourse(chairman, section, -3)
    const courseB = await publishCourse(chairman, section, -3)
    const courseBare = await publishCourse(chairman, section, -3, { guarantee_days: 0 })
    fee = amount(courseA.fee_month)

    learner = freshMember({ prefix: 'edug' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    const self = await addLearner(token, 'Сам участник', true)
    const child = await addLearner(token, 'Ребёнок участника')
    await fundShare(learner, token, fee * 5)
    granted = await subscribe(learner, token, self.id, courseA.id)
    declined = await subscribe(learner, token, child.id, courseB.id)
    bare = await subscribe(learner, token, self.id, courseBare.id)
    // Группа идёт двадцать дней при сроке в четырнадцать: гарантийный срок группы вышел.
    const courseLate = await publishCourse(chairman, section, -20)
    late = await subscribe(learner, token, child.id, courseLate.id)

    stranger = freshMember({ prefix: 'eduh' })
    strangerToken = await login(stranger)
    await signOffer(stranger, strangerToken, 'PARENT')
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.enroll.break.10', 'заявление по гарантии не принимается: чужая подписка, пустая причина, курс без гарантии, срок группы вышел, чужая подпись'), async () => {
    const state = await guaranteeOf(token, declined.id)
    expect(state).toMatchObject({ available: true, claim: null })
    expect(amount(state.amount)).toBeCloseTo(fee, 4)
    expect(Date.parse(state.guarantee_until), 'срок гарантии ещё идёт').toBeGreaterThan(Date.now())

    expectCode(await gqlError(strangerToken, GUARANTEE_STATEMENT, statementInput(declined.id)), 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND')
    expectCode(await gqlError(token, GUARANTEE_STATEMENT, statementInput(declined.id, '   ')), 'EDUBRIDGE_GUARANTEE_REASON_REQUIRED')

    expect(await guaranteeOf(token, bare.id)).toMatchObject({ available: false, guarantee_until: null, claim: null })
    expectCode(await gqlError(token, GUARANTEE_STATEMENT, statementInput(bare.id)), 'EDUBRIDGE_GUARANTEE_NOT_AVAILABLE')

    // Гарантийный срок один на группу, от начала занятий: пришедший после него гарантийных условий не имеет.
    const lateState = await guaranteeOf(token, late.id)
    expect(lateState).toMatchObject({ available: false, claim: null })
    expect(Date.parse(lateState.guarantee_until), 'срок группы уже вышел').toBeLessThan(Date.now())
    expectCode(await gqlError(token, GUARANTEE_STATEMENT, statementInput(late.id)), 'EDUBRIDGE_GUARANTEE_NOT_AVAILABLE')

    // Заявление участника, подписанное чужим ключом от чужого имени.
    const statement = (await gql<any>(token, GUARANTEE_STATEMENT, statementInput(declined.id))).edubridgeGuaranteeStatement
    const foreign = await signDocument(stranger.wif, statement, stranger.account, 1)
    expectCode(await gqlError(token, SUBMIT_GUARANTEE, { d: { ...statementInput(declined.id).d, document: foreign } }), 'EDUBRIDGE_GUARANTEE_NOT_SIGNED')

    expect(await claimOf(declined.id), 'заявления по подписке нет').toBeNull()
    expect((await enrollmentOf(token, declined.id))?.status).toBe('ACTIVE')
  })

  it(caseName('edu.enroll.side.24', 'пока заявление на рассмотрении совета, обычная отмена подписки отклоняется'), async () => {
    const claim = await submitGuaranteeClaim(learner, token, granted.id, 'Преподаватель не проводит занятия', ['https://example.org/proof'])
    expect(claim).toMatchObject({ status: 'SUBMITTED', reason: 'Преподаватель не проводит занятия', links: ['https://example.org/proof'], decided_at: null })
    expect(amount(claim.amount)).toBeCloseTo(fee, 4)

    const state = await guaranteeOf(token, granted.id)
    expect(state.available, 'второе заявление по той же подписке подать нельзя').toBe(false)
    expect(state.claim).toMatchObject({ id: claim.id, status: 'SUBMITTED' })
    expectCode(await gqlError(token, GUARANTEE_STATEMENT, statementInput(granted.id)), 'EDUBRIDGE_GUARANTEE_ALREADY_CLAIMED')

    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: granted.id }), UNDER_REVIEW)
    // Подписка и доступ на время рассмотрения действуют.
    expect((await enrollmentOf(token, granted.id))?.status).toBe('ACTIVE')
  })

  it(caseName('edu.enroll.happy.20', 'совет удовлетворил заявление — подписка закрыта, вся стоимость возвращена на главный паевой'), async () => {
    const claim = await claimOf(granted.id)
    const shareBefore = await wallet(SHARE_WALLET)
    const programBefore = await wallet(PROGRAM_WALLET)

    await councilGrants(await guaranteeAgenda(claim.id))

    const approved = await waitFor(async () => {
      const c = await claimOf(granted.id)
      return c?.status === 'APPROVED' ? c : null
    }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'заявление по гарантии удовлетворено' })
    expect(approved.decided_at, 'дата решения совета').toBeTruthy()

    const closed = await enrollmentOf(token, granted.id)
    expect(closed).toMatchObject({ status: 'CANCELLED', refund_reason: 'guarantee' })
    expect(amount(closed.refunded_amount), 'возвращена вся стоимость, а не половина').toBeCloseTo(fee, 4)

    expect(await wallet(SHARE_WALLET), 'возврат лёг на главный паевой').toBeCloseTo(shareBefore + fee, 4)
    expect(await wallet(PROGRAM_WALLET), 'кошелёк программы не изменился').toBeCloseTo(programBefore, 4)
    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: granted.id }), 'EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED')
  }, 480_000)

  it(caseName('edu.enroll.side.23', 'совет отклонил заявление — оно закрыто, подписка действует, обычный отказ снова открыт'), async () => {
    const claim = await submitGuaranteeClaim(learner, token, declined.id, 'Курс оказался сложнее ожидаемого')
    expect(claim.status).toBe('SUBMITTED')
    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: declined.id }), UNDER_REVIEW)
    const shareBefore = await wallet(SHARE_WALLET)
    const programBefore = await wallet(PROGRAM_WALLET)

    await councilDeclines(await guaranteeAgenda(claim.id))

    const closedClaim = await waitFor(async () => {
      const c = await claimOf(declined.id)
      return c?.status === 'DECLINED' ? c : null
    }, { timeoutMs: 120_000, intervalMs: 1_500, label: 'заявление по гарантии отклонено советом' })
    expect(closedClaim.decided_at).toBeTruthy()
    expect((await enrollmentOf(token, declined.id))?.status, 'подписка действует').toBe('ACTIVE')
    expect(await wallet(SHARE_WALLET), 'возврата не было').toBeCloseTo(shareBefore, 4)

    // Повторное заявление по той же подписке не подаётся.
    expectCode(await gqlError(token, GUARANTEE_STATEMENT, statementInput(declined.id)), 'EDUBRIDGE_GUARANTEE_ALREADY_CLAIMED')

    // Заморозка взноса снята отказом совета: обычный отказ снова проходит и
    // возвращает половину остаточной стоимости на кошелёк программы.
    const cancelled = (await gql<any>(token, CANCEL_ENROLLMENT, { id: declined.id })).edubridgeCancelEnrollment
    expect(cancelled).toMatchObject({ status: 'CANCELLED', refund_reason: 'refusal' })
    expect(amount(cancelled.refunded_amount)).toBeCloseTo(fee / 2, 4)
    expect(await wallet(PROGRAM_WALLET)).toBeCloseTo(programBefore + fee / 2, 4)
  }, 480_000)

  it(caseName('edu.enroll.side.28', 'отказ совета снимает заморозку взноса: по закрытой подписке второй возврат не проходит'), async () => {
    // Отказ после решения совета уже прошёл (заморозка снята контрактом); подписка закрыта — повтор отклоняется.
    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: declined.id }), 'EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED')
    expect((await claimOf(declined.id))?.status).toBe('DECLINED')
  })
})
