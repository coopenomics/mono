/**
 * Ученик программы «Образование» снаружи (test-registry/edubridge.enrollment.yaml):
 * оферта ученика со стола, обучающиеся, подписка на курс конвертацией паевого
 * взноса, отмена подписки с возвратом по Положению ЦПП.
 *
 * До начала занятий возвращается вся стоимость (п. 4.3.2 Положения), после
 * начала — половина остаточной стоимости за вычетом использованного
 * (п. 4.4.3.1). Возврат ложится на кошелёк программы пайщика и первым идёт в
 * оплату следующей подписки (п. 4.2.5).
 *
 * Курсы очные: доступ выдаётся пропуском, чужие площадки не участвуют. Ученик
 * и «чужой» пайщик — свежие, их кошельки и подписки больше нигде не нужны.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  ADD_LEARNER,
  CANCEL_ENROLLMENT,
  MY_ENROLLMENTS,
  MY_LEARNERS,
  NO_RIGHTS,
  PROGRAM_WALLET,
  QUOTE,
  REFUND_PREVIEW,
  REMOVE_LEARNER,
  RETURN_BALANCE,
  SHARE_WALLET,
  SUBSCRIBE,
  UPDATE_LEARNER,
  addLearner,
  createSection,
  deskGrants,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  offersState,
  publishCourse,
  quoteOf,
  signOffer,
  signedConvertStatement,
  subscribe,
  walletOf,
} from './edubridge.helpers'

describe('Образование: ученик — оферта, обучающиеся, подписка и отмена с возвратом', () => {
  let learner: Who
  let token = ''
  let stranger: Who
  let strangerToken = ''
  /** Занятия начнутся через месяц: отмена возвращает всю стоимость. */
  let courseAhead: any
  /** Вторая подписка оплачивается возвратом с кошелька программы. */
  let courseNext: any
  /** Занятия идут: отказ возвращает половину остаточной стоимости. */
  let courseRunning: any
  let fee = 0
  let self: any
  let child: any
  let first: any
  let second: any

  const wallet = (name: string) => walletOf(token, learner.account, name)
  const monthOf = (learnerId: string, courseId: string) => ({ d: { learner_id: learnerId, course_id: courseId, period: 'MONTH' } })

  beforeAll(async () => {
    await educationOn()
    const chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    courseAhead = await publishCourse(chairman, section, 30)
    courseNext = await publishCourse(chairman, section, 30)
    courseRunning = await publishCourse(chairman, section, -3)
    fee = amount(courseAhead.fee_month)

    learner = freshMember({ prefix: 'edul' })
    token = await login(learner)
    stranger = freshMember({ prefix: 'edus' })
    strangerToken = await login(stranger)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it('взнос за месяц посчитан сервером и одинаков у курсов с одной программой', () => {
    expect(fee).toBeGreaterThan(0)
    expect(courseNext.fee_month).toBe(courseAhead.fee_month)
    expect(courseRunning.fee_month).toBe(courseAhead.fee_month)
    expect(courseAhead.status).toBe('PUBLISHED')
  })

  it('пайщик подписывает оферту ученика со стола — стол ученика открыт', async () => {
    const before = await offersState(token)
    expect(before.parent).toMatchObject({ kind: 'PARENT', requires_gate: true, source: 'GATE_REQUIRED' })
    expectCode(await gqlError(token, MY_LEARNERS), NO_RIGHTS)
    expect(await deskGrants(token)).toContain('Onboarding:learner')

    const after = await signOffer(learner, token, 'PARENT')
    expect(after.parent).toMatchObject({ kind: 'PARENT', requires_gate: false, source: 'AGREEMENT_SIGNED' })
    expect(after.parent.signed_at, 'дата подписи оферты').toBeTruthy()
    // Оферта преподавателя — отдельная подпись.
    expect(after.teacher.source).toBe('GATE_REQUIRED')

    const grants = await deskGrants(token)
    expect(grants).toEqual(expect.arrayContaining(['EduLearner:read:own', 'EduLearner:manage:own', 'EduEnrollment:read:own', 'EduEnrollment:create:own']))
    expect(grants).not.toContain('Onboarding:learner')
    expect((await gql<any>(token, MY_LEARNERS)).edubridgeMyLearners).toEqual([])
  })

  it('ученик добавляет обучающимся себя и другого человека; второй раз себя добавить нельзя', async () => {
    self = await addLearner(token, 'Сам ученик', true)
    child = await addLearner(token, 'Ребёнок ученика')
    expect(self).toMatchObject({ display_name: 'Сам ученик', is_self: true, recipient_type: 'ONSITE' })
    expect(child).toMatchObject({ display_name: 'Ребёнок ученика', is_self: false })

    expectCode(await gqlError(token, ADD_LEARNER, { d: { display_name: 'Снова я', recipient_type: 'ONSITE', recipient_value: 'пропуск-второй', is_self: true } }), 'EDUBRIDGE_LEARNER_SELF_ALREADY_ADDED')
    expectCode(await gqlError(token, ADD_LEARNER, { d: { display_name: 'Тот же пропуск', recipient_type: 'ONSITE', recipient_value: child.recipient_value } }), 'EDUBRIDGE_LEARNER_CONTACT_DUPLICATE')

    const mine = (await gql<any>(token, MY_LEARNERS)).edubridgeMyLearners as any[]
    expect(mine.map(l => l.id).sort()).toEqual([self.id, child.id].sort())
  })

  it(caseName('edu.enr.happy.01', 'котировка называет взнос за месяц; паевого не хватает — видна недостача'), async () => {
    const q = await quoteOf(token, self.id, courseAhead.id)
    expect(q.amount).toBe(courseAhead.fee_month)
    expect(q.months).toBe(1)
    expect(q.is_extension).toBe(false)
    expect(amount(q.available), 'у свежего пайщика паевого меньше взноса').toBeLessThan(fee)
    expect(amount(q.from_program)).toBe(0)
    expect(amount(q.to_convert)).toBeCloseTo(fee, 4)
    expect(q.enough).toBe(false)
    expect(amount(q.shortfall)).toBeCloseTo(fee - amount(q.available), 4)
  })

  it(caseName('edu.enr.break.01', 'подписка при нехватке паевого отклоняется, подписки нет'), async () => {
    const document = await signedConvertStatement(learner, token, self.id, courseAhead.id)
    expectCode(await gqlError(token, SUBSCRIBE, { d: { ...monthOf(self.id, courseAhead.id).d, document } }), 'EDUBRIDGE_INSUFFICIENT_FUNDS')
    expect((await gql<any>(token, MY_ENROLLMENTS)).edubridgeMyEnrollments).toEqual([])
  })

  it(caseName('edu.enr.happy.02', 'подписка на курс: взнос конвертирован с паевого, подписка действует'), async () => {
    await fundShare(learner, token, fee * 3)
    const shareBefore = await wallet(SHARE_WALLET)

    const q = await quoteOf(token, self.id, courseAhead.id)
    expect(q.enough).toBe(true)
    expect(amount(q.shortfall)).toBe(0)

    first = await subscribe(learner, token, self.id, courseAhead.id)
    expect(first).toMatchObject({ learner_id: self.id, course_id: courseAhead.id, course_title: courseAhead.title, period: 'MONTH', status: 'ACTIVE', sub_hash: q.sub_hash })
    expect(amount(first.paid_amount)).toBeCloseTo(fee, 4)
    expect(Date.parse(first.paid_until)).toBeGreaterThan(Date.now())
    expect(first.refunded_amount).toBeNull()

    expect(await wallet(SHARE_WALLET)).toBeCloseTo(shareBefore - fee, 4)
    expect(await wallet(PROGRAM_WALLET), 'взнос ушёл в фонд программы, на кошельке пайщика его нет').toBe(0)
    expect((await enrollmentOf(token, first.id))?.status).toBe('ACTIVE')
  })

  it(caseName('edu.enroll.happy.06', 'отмена до начала занятий возвращает всю стоимость на кошелёк программы'), async () => {
    const shareBefore = await wallet(SHARE_WALLET)
    const preview = (await gql<any>(token, REFUND_PREVIEW, { id: first.id })).edubridgeRefundPreview
    expect(preview).toMatchObject({ reason: 'before_start', lessons_used: 0, to_share: false })
    expect(amount(preview.refund)).toBeCloseTo(fee, 4)
    expect(amount(preview.withheld)).toBe(0)

    const cancelled = (await gql<any>(token, CANCEL_ENROLLMENT, { id: first.id })).edubridgeCancelEnrollment
    expect(cancelled).toMatchObject({ id: first.id, status: 'CANCELLED', refund_reason: 'before_start' })
    expect(amount(cancelled.refunded_amount)).toBeCloseTo(fee, 4)
    expect(cancelled.cancelled_at).toBeTruthy()

    expect(await wallet(PROGRAM_WALLET), 'возврат лёг на кошелёк программы').toBeCloseTo(fee, 4)
    expect(await wallet(SHARE_WALLET), 'на паевой возврат не идёт').toBeCloseTo(shareBefore, 4)
    const balance = (await gql<any>(token, RETURN_BALANCE)).edubridgeReturnBalance
    expect(amount(balance.available)).toBeCloseTo(fee, 4)
    expect(balance.subscriptions).toBe(0)
  })

  it(caseName('edu.enroll.break.03', 'повторная отмена и отмена чужой подписки отклоняются'), async () => {
    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: first.id }), 'EDUBRIDGE_SUBSCRIPTION_ALREADY_CLOSED')

    await signOffer(stranger, strangerToken, 'PARENT')
    expectCode(await gqlError(strangerToken, CANCEL_ENROLLMENT, { id: first.id }), 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND')
    expectCode(await gqlError(strangerToken, REFUND_PREVIEW, { id: first.id }), 'EDUBRIDGE_SUBSCRIPTION_NOT_FOUND')
    expect((await gql<any>(strangerToken, MY_ENROLLMENTS)).edubridgeMyEnrollments).toEqual([])
    expect(await wallet(PROGRAM_WALLET), 'кошелёк программы ученика не изменился').toBeCloseTo(fee, 4)
  })

  it(caseName('edu.enroll.happy.10', 'остаток кошелька программы покрывает взнос целиком — паевой не трогается'), async () => {
    const shareBefore = await wallet(SHARE_WALLET)
    const q = await quoteOf(token, child.id, courseNext.id)
    expect(amount(q.from_program)).toBeCloseTo(fee, 4)
    expect(amount(q.to_convert)).toBe(0)
    expect(q.enough).toBe(true)

    second = await subscribe(learner, token, child.id, courseNext.id)
    expect(second).toMatchObject({ learner_id: child.id, course_id: courseNext.id, status: 'ACTIVE' })
    expect(amount(second.paid_amount)).toBeCloseTo(fee, 4)
    expect(await wallet(PROGRAM_WALLET)).toBe(0)
    expect(await wallet(SHARE_WALLET)).toBeCloseTo(shareBefore, 4)
  })

  it(caseName('edu.enr.break.02', 'чужого обучающегося не поправить и не подписать; обучающегося с действующей подпиской не удалить'), async () => {
    const edit = { d: { id: child.id, display_name: 'Чужая правка', recipient_type: 'ONSITE', recipient_value: 'пропуск-чужой' } }
    expectCode(await gqlError(strangerToken, UPDATE_LEARNER, edit), 'EDUBRIDGE_LEARNER_FOREIGN')
    expectCode(await gqlError(strangerToken, REMOVE_LEARNER, { id: child.id }), 'EDUBRIDGE_LEARNER_FOREIGN')
    expectCode(await gqlError(strangerToken, QUOTE, monthOf(child.id, courseRunning.id)), 'EDUBRIDGE_LEARNER_FOREIGN')

    expectCode(await gqlError(token, REMOVE_LEARNER, { id: child.id }), 'EDUBRIDGE_LEARNER_HAS_ACTIVE_SUBSCRIPTIONS')
    const mine = (await gql<any>(token, MY_LEARNERS)).edubridgeMyLearners as any[]
    expect(mine.find(l => l.id === child.id)?.display_name).toBe('Ребёнок ученика')
  })

  it(caseName('edu.enroll.happy.08', 'отказ после начала занятий возвращает половину остаточной стоимости'), async () => {
    const running = await subscribe(learner, token, self.id, courseRunning.id)
    expect(running.status).toBe('ACTIVE')
    expect(amount(running.paid_amount)).toBeCloseTo(fee, 4)
    const shareBefore = await wallet(SHARE_WALLET)

    // Ученик вписался в идущий курс сегодня: оплаченные занятия ещё не начались,
    // остаточная стоимость равна всему взносу, возвращается её половина.
    const preview = (await gql<any>(token, REFUND_PREVIEW, { id: running.id })).edubridgeRefundPreview
    expect(preview).toMatchObject({ reason: 'refusal', lessons_used: 0, to_share: false })
    expect(preview.lessons_paid).toBe(courseRunning.lessons_per_month)
    expect(amount(preview.refund)).toBeCloseTo(fee / 2, 4)
    expect(amount(preview.withheld)).toBeCloseTo(fee / 2, 4)

    const cancelled = (await gql<any>(token, CANCEL_ENROLLMENT, { id: running.id })).edubridgeCancelEnrollment
    expect(cancelled).toMatchObject({ id: running.id, status: 'CANCELLED', refund_reason: 'refusal' })
    expect(amount(cancelled.refunded_amount)).toBeCloseTo(fee / 2, 4)

    expect(await wallet(PROGRAM_WALLET), 'половина остаточной стоимости на кошельке программы').toBeCloseTo(fee / 2, 4)
    expect(await wallet(SHARE_WALLET)).toBeCloseTo(shareBefore, 4)
    // Подписка ребёнка на другой курс от отказа не зависит.
    expect((await enrollmentOf(token, second.id))?.status).toBe('ACTIVE')
  })
})
