/**
 * Образование: конец гарантийного срока группы.
 *
 * Пока срок идёт, преподаватель подаёт отчёты без суммы и документов, а
 * заявление ученика по гарантийным условиям замораживает его взнос. Срок
 * вышел — сумма преподавателя за занятия периода считается только по
 * оставшимся ученикам: вернувший взнос по гарантии в неё не входит, и ученик,
 * которому совет отказал уже после срока, тоже — оплата его занятий остаётся
 * программе. На все занятия периода преподавателю заводится один взнос.
 *
 * Время на стенде не перематывается, поэтому набор идёт только с короткими
 * сутками гарантийного срока (`EDUBRIDGE_GUARANTEE_DAY_SECONDS` у контроллера,
 * `BLACKBOX_GUARANTEE_DAY_SECONDS` у наборов): срок кончается через несколько
 * минут после занятий, очередь расширения проходит раз в десять минут.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf, waitFor } from '../core'
import {
  CANCEL_ENROLLMENT,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  GUARANTEE_DAY_SECONDS,
  MY_CONTRIBUTIONS,
  MY_LESSONS,
  REFUND_PREVIEW,
  REPORT_LESSON,
  SET_COURSE_STATUS,
  SHARE_WALLET,
  addLearner,
  courseInput,
  createSection,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  guaranteeAgenda,
  guaranteeFor,
  guaranteeOf,
  councilDeclines,
  councilGrants,
  holdMaterials,
  onboardTeacher,
  reportLesson,
  signOffer,
  submitGuaranteeClaim,
  submitStatement,
  subscribe,
  walletOf,
} from './edubridge.helpers'

/** Ставка преподавателя за час на одного обучающегося; плановая ставка курса — 1000. */
const RATE = '900.0000 RUB'
const LESSON = 900
/** Сколько гарантийный срок идёт после открытия группы: за это время проходят подписки, занятия и заявления. */
const WINDOW_SECONDS = 600
/** Набор идёт только с короткими сутками: с обычными конца срока не дождаться. */
const SHORT_DAYS = GUARANTEE_DAY_SECONDS <= 3600

describe.runIf(SHORT_DAYS)('Образование: конец гарантийного срока группы — сумма преподавателя и замороженные взносы', () => {
  let chairman = ''
  let teacher: Who
  let teacherToken = ''
  let learner: Who
  let token = ''
  let course: any
  let assignment: any
  let endsAt = 0
  let fee = 0
  /** Остаётся в группе. */
  let stays: any
  /** Заявление по гарантии совет удовлетворит. */
  let granted: any
  /** Заявление по гарантии совет отклонит уже после срока. */
  let declined: any
  let pack: any

  const claimOf = async (enrollmentId: string) => (await guaranteeOf(token, enrollmentId))?.claim ?? null
  const contributions = async (): Promise<any[]> => (await gql<any>(teacherToken, MY_CONTRIBUTIONS)).edubridgeMyContributions
  const lessonsOfCourse = async (): Promise<any[]> =>
    ((await gql<any>(teacherToken, MY_LESSONS)).edubridgeMyLessons as any[]).filter(l => l.course_id === course.id)

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    teacher = freshMember({ prefix: 'edut' })
    teacherToken = await login(teacher)
    await onboardTeacher(teacher, teacherToken, RATE)
    learner = freshMember({ prefix: 'eduv' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    const first = await addLearner(token, 'Остаётся в группе', true)
    const second = await addLearner(token, 'Вернёт взнос по гарантии')
    const third = await addLearner(token, 'Получит отказ совета после срока')
    await fundShare(learner, token, 60_000)

    // Группа открывается последней: гарантийный срок кончится через несколько минут.
    const term = guaranteeFor(WINDOW_SECONDS)
    endsAt = term.ends_at
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: term.starts_at, guarantee_days: term.guarantee_days }) })).edubridgeCreateCourse
    course = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
    fee = amount(course.fee_month)
    assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: term.starts_at, period_to: term.starts_at.replace(/^\d{4}/, y => String(Number(y) + 1)) },
    })).edubridgeCreateAssignment
    stays = await subscribe(learner, token, first.id, course.id)
    granted = await subscribe(learner, token, second.id, course.id)
    declined = await subscribe(learner, token, third.id, course.id)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.teach.side.26', 'в гарантийный срок два занятия отчитаны без взноса и документов'), async () => {
    expect(Date.now(), 'гарантийный срок группы ещё идёт').toBeLessThan(endsAt)
    const before = (await contributions()).length
    for (const n of [1, 2]) {
      const lesson = (await gql<any>(teacherToken, REPORT_LESSON, { d: { assignment_id: assignment.id, lesson_number: n, materials: [`https://example.org/term-${n}`], topic: `Занятие ${n}` } })).edubridgeReportLesson
      expect(lesson).toMatchObject({ lesson_number: n, contribution_id: null })
    }
    expect((await contributions()).length, 'взносов и документов с суммой нет').toBe(before)
    // Занятия проведены всем троим: по каждой подписке два из восьми.
    for (const e of [stays, granted, declined])
      expect((await gql<any>(token, REFUND_PREVIEW, { id: e.id })).edubridgeRefundPreview.lessons_used).toBe(2)
  })

  it(caseName('edu.enroll.side.29', 'заявление по гарантии удовлетворено: весь взнос возвращён, хотя занятия уже проведены'), async () => {
    const shareBefore = await walletOf(token, learner.account, SHARE_WALLET)
    const claim = await submitGuaranteeClaim(learner, token, granted.id, 'Занятия не подошли')
    // Второе заявление подаётся до конца срока и останется на рассмотрении, когда срок выйдет.
    await submitGuaranteeClaim(learner, token, declined.id, 'Хочу вернуть взнос')
    await councilGrants(await guaranteeAgenda(claim.id))
    await waitFor(async () => ((await claimOf(granted.id))?.status === 'APPROVED' ? true : null),
      { timeoutMs: 180_000, intervalMs: 2_000, label: 'заявление по гарантии удовлетворено' })
    const closed = await enrollmentOf(token, granted.id)
    expect(closed).toMatchObject({ status: 'CANCELLED', refund_reason: 'guarantee' })
    expect(amount(closed.refunded_amount)).toBeCloseTo(fee, 4)
    expect(await walletOf(token, learner.account, SHARE_WALLET)).toBeCloseTo(shareBefore + fee, 4)
  }, 480_000)

  it(caseName('edu.enroll.side.27', 'срок вышел, заявление на рассмотрении: взнос заморожен, взнос преподавателю за период не заводится'), async () => {
    await waitFor(async () => (Date.now() > endsAt + 20_000 ? true : null),
      { timeoutMs: (WINDOW_SECONDS + GUARANTEE_DAY_SECONDS + 120) * 1000, intervalMs: 5_000, label: 'гарантийный срок группы вышел' })
    expect((await claimOf(declined.id))?.status, 'заявление всё ещё на рассмотрении совета').toBe('SUBMITTED')
    // Пока одна подписка группы не закрыла срок, сумма преподавателя не окончательна.
    expect((await lessonsOfCourse()).every(l => l.contribution_id === null)).toBe(true)
    // Обычный отказ во время рассмотрения закрыт.
    expectCode(await gqlError(token, CANCEL_ENROLLMENT, { id: declined.id }), 'EDUBRIDGE_SUBSCRIPTION_GUARANTEE_UNDER_REVIEW')
  }, 1_200_000)

  it(caseName('edu.teach.side.07', 'совет отказал после срока: преподавателю заведён один взнос на занятия периода — только по оставшемуся ученику'), async () => {
    await councilDeclines(await guaranteeAgenda((await claimOf(declined.id)).id))
    await waitFor(async () => ((await claimOf(declined.id))?.status === 'DECLINED' ? true : null),
      { timeoutMs: 180_000, intervalMs: 2_000, label: 'заявление по гарантии отклонено советом' })
    expect((await enrollmentOf(token, declined.id))?.status, 'подписка продолжает действовать').toBe('ACTIVE')

    // Очередь расширения проходит раз в десять минут: подписки закрывают срок, и появляется взнос.
    const lessons = await waitFor(async () => {
      const rows = await lessonsOfCourse()
      return rows.length === 2 && rows.every(l => l.contribution_id) ? rows : null
    }, { timeoutMs: 900_000, intervalMs: 10_000, label: 'взнос преподавателя за занятия гарантийного срока заведён' })
    expect(new Set(lessons.map(l => l.contribution_id)).size, 'один взнос на оба занятия').toBe(1)
    pack = (await contributions()).find(c => c.id === lessons[0].contribution_id)
    expect(pack).toMatchObject({ status: 'DRAFT', teacher_username: teacher.account, assignment_id: assignment.id })
    // Трое были на двух занятиях. Один вернул взнос по гарантии, другому совет отказал
    // после срока — оплата его занятий осталась программе. В сумме — один ученик.
    expect(amount(pack.amount)).toBe(LESSON * 2)
    expect(pack.links.sort()).toEqual(['https://example.org/term-1', 'https://example.org/term-2'])
  }, 1_500_000)

  it(caseName('edu.teach.side.27', 'материалы занятий периода приняты одним актом, заявление уходит совету сразу'), async () => {
    const kept = await holdMaterials(teacher, teacherToken, pack.id)
    expect(kept).toMatchObject({ status: 'HELD' })
    expect(amount(kept.amount)).toBe(LESSON * 2)
    const submitted = await submitStatement(teacher, teacherToken, pack.id)
    expect(submitted.status, 'гарантийный срок вышел — заявление не держится').toBe('SUBMITTED')
  }, 300_000)

  it(caseName('edu.teach.side.28', 'после срока занятие даёт взнос сразу — по обоим ученикам с действующей подпиской'), async () => {
    const r = await reportLesson(teacherToken, assignment.id, 3)
    expect(r.contribution).toMatchObject({ status: 'DRAFT' })
    // Ученик, которому совет отказал, продолжает учиться: его взнос разморожен и участвует в расчёте.
    expect(amount(r.contribution.amount)).toBe(LESSON * 2)
    expect((await gql<any>(token, REFUND_PREVIEW, { id: declined.id })).edubridgeRefundPreview.lessons_used).toBe(3)
  }, 300_000)
})
