/**
 * Образование: группы курса и расчёт занятия контрактом.
 *
 * Группа — единица расчёта: у неё свои условия (взнос, плановая ставка,
 * гарантийный срок), свои обучающиеся и свой порядок занятий. Условия курса —
 * образец для новых групп. Суммы считает контракт: взнос преподавателя за
 * занятие — по подпискам с оплаченным доступом на дату занятия, возврат при
 * отказе — половина доли взноса за ещё не проведённые занятия. Набор проверяет,
 * что эти суммы доходят до клиента.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  CANCEL_ENROLLMENT,
  COURSE,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  PROGRAM_WALLET,
  QUOTE,
  REFUND_PREVIEW,
  SET_COURSE_STATUS,
  UPDATE_COURSE,
  addLearner,
  courseInput,
  createSection,
  dayFromNow,
  educationOff,
  educationOn,
  fundShare,
  hasStarted,
  holdMaterials,
  onboardTeacher,
  reportLesson,
  reopenEnrollment,
  signOffer,
  subscribe,
  walletOf,
} from './edubridge.helpers'

const GROUP_FIELDS = 'id course_id title status enrollment_open starts_at fee_month planned_hourly_rate pay_per_learner lessons_total guarantee_days learners_active lessons_held'
const COURSE_GROUPS = `query($id:ID!){ edubridgeCourseGroups(course_id:$id){ ${GROUP_FIELDS} } }`
const OPEN_GROUPS = `query($id:ID!){ edubridgeOpenGroups(course_id:$id){ ${GROUP_FIELDS} } }`
const CREATE_GROUP = `mutation($d:EduCreateGroupInput!){ edubridgeCreateGroup(data:$d){ ${GROUP_FIELDS} } }`
const UPDATE_GROUP = `mutation($d:EduUpdateGroupInput!){ edubridgeUpdateGroup(data:$d){ ${GROUP_FIELDS} } }`
const MY_ENROLLMENT_GROUPS = 'query{ edubridgeMyEnrollments{ id group_id status } }'

/** Ставка преподавателя за час на одного обучающегося; плановая ставка курсов набора — 1000. */
const RATE = '900.0000 RUB'

describe('Образование: группы курса и расчёт занятия контрактом', () => {
  let chairman = ''
  let section = ''
  let learner: Who
  let token = ''
  let self: any
  let child: any
  let teacher: Who
  let teacherToken = ''

  const create = async (over: Record<string, unknown> = {}) => {
    const input = courseInput(section, over)
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: input })).edubridgeCreateCourse
    if (hasStarted(input)) await reopenEnrollment(chairman, created.id)
    const course = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
    return { input, course }
  }
  const groupsOf = async (courseId: string): Promise<any[]> => (await gql<any>(chairman, COURSE_GROUPS, { id: courseId })).edubridgeCourseGroups
  const quoteInput = (learnerId: string, courseId: string, groupId?: string) =>
    ({ d: { learner_id: learnerId, course_id: courseId, period: 'MONTH', ...(groupId ? { group_id: groupId } : {}) } })
  const groupOfEnrollment = async (id: string): Promise<string | null> =>
    ((await gql<any>(token, MY_ENROLLMENT_GROUPS)).edubridgeMyEnrollments as any[]).find(e => e.id === id)?.group_id ?? null
  const preview = async (enrollmentId: string) => (await gql<any>(token, REFUND_PREVIEW, { id: enrollmentId })).edubridgeRefundPreview
  /** Идущий курс без гарантийного срока с допущенным преподавателем. */
  const runningCourse = async (over: Record<string, unknown> = {}) => {
    const { course } = await create({ starts_at: dayFromNow(-3), guarantee_days: 0, ...over })
    const assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment
    return { course, assignment }
  }
  /** Занятие отчитано и материалы переданы на хранение: журнал группы открыт для следующего. */
  const heldLesson = async (assignmentId: string, n: number): Promise<number> => {
    const r = await reportLesson(teacherToken, assignmentId, n)
    await holdMaterials(teacher, teacherToken, r.contribution.id)
    return amount(r.contribution.amount)
  }

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    learner = freshMember({ prefix: 'edug' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    self = await addLearner(token, 'Плательщик набора групп', true)
    child = await addLearner(token, 'Второй обучающийся набора групп')
    await fundShare(learner, token, 120_000)
    teacher = freshMember({ prefix: 'eduh' })
    teacherToken = await login(teacher)
    await onboardTeacher(teacher, teacherToken, RATE)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  describe('группа курса: условия и набор', () => {
    let course: any
    let input: Record<string, unknown>
    let first: any
    let second: any
    let paid: any

    it(caseName('edu.enroll.happy.21', 'курс открывается с первой группой на его условиях; новая группа берёт условия курса на день открытия'), async () => {
      ({ input, course } = await create({ starts_at: dayFromNow(30) }))
      const groups = await groupsOf(course.id)
      expect(groups).toHaveLength(1)
      first = groups[0]
      expect(first).toMatchObject({
        course_id: course.id,
        status: 'ACTIVE',
        enrollment_open: true,
        starts_at: dayFromNow(30),
        fee_month: course.fee_month,
        planned_hourly_rate: input.planned_hourly_rate,
        pay_per_learner: true,
        lessons_total: 32,
        guarantee_days: 14,
        learners_active: 0,
        lessons_held: 0,
      })
      // Группы курса ведёт администратор.
      expect(await gqlError(token, COURSE_GROUPS, { id: course.id })).not.toBeNull()
      expect(await gqlError(token, CREATE_GROUP, { d: { course_id: course.id } })).not.toBeNull()

      // Обучающийся записывается в единственную группу с открытым набором.
      paid = await subscribe(learner, token, self.id, course.id)
      expect(await groupOfEnrollment(paid.id)).toBe(first.id)
      expect((await groupsOf(course.id))[0].learners_active).toBe(1)
    })

    it(caseName('edu.enroll.side.26', 'условия курса изменены: группа с обучающимися остаётся на прежних, новая группа берёт новые; группа с подписками не завершается'), async () => {
      // При действующих подписках условия курса правятся: они действуют для новых групп.
      await gql(chairman, UPDATE_COURSE, { d: { ...input, id: course.id, planned_hourly_rate: '1200.0000 RUB' } })
      const repriced = (await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse
      expect(amount(repriced.fee_month), 'взнос курса пересчитан по новой ставке').toBeGreaterThan(amount(course.fee_month))

      const kept = (await groupsOf(course.id)).find(g => g.id === first.id)
      expect(kept).toMatchObject({ fee_month: course.fee_month, planned_hourly_rate: input.planned_hourly_rate })
      // Продление в прежней группе — по её взносу.
      const extension = (await gql<any>(token, QUOTE, quoteInput(self.id, course.id, first.id))).edubridgeQuote
      expect(extension.group_id, 'продление — в группе подписки').toBe(first.id)
      expect(extension.is_extension, 'это продление действующей подписки').toBe(true)
      expect(amount(extension.amount)).toBeCloseTo(amount(course.fee_month), 4)

      second = (await gql<any>(chairman, CREATE_GROUP, { d: { course_id: course.id, starts_at: dayFromNow(45) } })).edubridgeCreateGroup
      expect(second).toMatchObject({ course_id: course.id, status: 'ACTIVE', enrollment_open: true, starts_at: dayFromNow(45), fee_month: repriced.fee_month, planned_hourly_rate: '1200.0000 RUB' })
      expect(second.id).not.toBe(first.id)
      expect(second.title, 'группы названы по-разному').not.toBe(first.title)
    })

    it(caseName('edu.enroll.side.25', 'запись в группу: при нескольких открытых группу выбирают, закрытый набор отклоняется, единственная открытая берётся сама'), async () => {
      const open = (await gql<any>(token, OPEN_GROUPS, { id: course.id })).edubridgeOpenGroups as any[]
      expect(open.map(g => g.id).sort()).toEqual([first.id, second.id].sort())
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, course.id)), 'EDUBRIDGE_GROUP_CHOICE_REQUIRED')

      // Взнос — по условиям названной группы.
      const inSecond = (await gql<any>(token, QUOTE, quoteInput(child.id, course.id, second.id))).edubridgeQuote
      expect(inSecond.group_id).toBe(second.id)
      expect(amount(inSecond.amount)).toBeCloseTo(amount(second.fee_month), 4)
      const inFirst = (await gql<any>(token, QUOTE, quoteInput(child.id, course.id, first.id))).edubridgeQuote
      expect(amount(inFirst.amount)).toBeCloseTo(amount(first.fee_month), 4)

      // Набор в первую группу закрыт: в неё не записаться, без названной группы берётся вторая.
      const closed = (await gql<any>(chairman, UPDATE_GROUP, { d: { id: first.id, enrollment_open: false } })).edubridgeUpdateGroup
      expect(closed.enrollment_open).toBe(false)
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, course.id, first.id)), 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED')
      expect(((await gql<any>(token, OPEN_GROUPS, { id: course.id })).edubridgeOpenGroups as any[]).map(g => g.id)).toEqual([second.id])
      const single = (await gql<any>(token, QUOTE, quoteInput(child.id, course.id))).edubridgeQuote
      expect(single.group_id).toBe(second.id)
      // Группа другого курса с этим курсом не сочетается.
      const { course: other } = await create({ starts_at: dayFromNow(30) })
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, other.id, second.id)), 'EDUBRIDGE_GROUP_NOT_FOUND')

      // Подписка закрывается: следующие случаи набора считают кошельки с чистого остатка.
      await gql(token, CANCEL_ENROLLMENT, { id: paid.id })
    })
  })

  describe('набор в начавшуюся группу', () => {
    it(caseName('edu.enroll.side.30', 'с дня начала занятий набор в группу закрыт; администратор открывает его снова и принимает участника'), async () => {
      const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: dayFromNow(0), guarantee_days: 0 }) })).edubridgeCreateCourse
      const course = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
      const [group] = await groupsOf(course.id)
      expect(group).toMatchObject({ status: 'ACTIVE', enrollment_open: false })
      expect((await gql<any>(token, OPEN_GROUPS, { id: course.id })).edubridgeOpenGroups).toEqual([])
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, course.id)), 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED')
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, course.id, group.id)), 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED')

      // Исключение: администратор открывает набор в идущую группу — участник записывается, и сам набор больше не закрывается.
      const reopened = (await gql<any>(chairman, UPDATE_GROUP, { d: { id: group.id, enrollment_open: true } })).edubridgeUpdateGroup
      expect(reopened.enrollment_open).toBe(true)
      expect((await gql<any>(token, QUOTE, quoteInput(child.id, course.id))).edubridgeQuote.group_id).toBe(group.id)
      expect((await groupsOf(course.id))[0].enrollment_open).toBe(true)

      // Начало перенесено на будущий день: набор открыт и закроется сам в новый день начала.
      const { course: ahead } = await create({ starts_at: dayFromNow(0) })
      const [late] = await groupsOf(ahead.id)
      await gql(chairman, UPDATE_GROUP, { d: { id: late.id, enrollment_open: false } })
      const moved = (await gql<any>(chairman, UPDATE_GROUP, { d: { id: late.id, starts_at: dayFromNow(30) } })).edubridgeUpdateGroup
      expect(moved).toMatchObject({ starts_at: dayFromNow(30), enrollment_open: true })
    })

    it(caseName('edu.enroll.side.31', 'срок программы группы вышел, действующих подписок нет — группа завершена сама, записи в неё нет'), async () => {
      // 32 занятия по 8 в месяц — четыре месяца; начало полгода назад.
      const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: dayFromNow(-200), guarantee_days: 0 }) })).edubridgeCreateCourse
      const course = (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
      const [group] = await groupsOf(course.id)
      expect(group).toMatchObject({ status: 'CLOSED', enrollment_open: false })
      expect((await gql<any>(token, OPEN_GROUPS, { id: course.id })).edubridgeOpenGroups).toEqual([])
      expectCode(await gqlError(token, QUOTE, quoteInput(child.id, course.id, group.id)), 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED')
    })
  })

  describe('расчёт занятия и возврат по подпискам группы', () => {
    it(caseName('edu.enroll.side.17', 'отказ в ходе занятий: возвращается половина доли взноса за ещё не проведённые занятия'), async () => {
      const { course, assignment } = await runningCourse()
      const fee = amount(course.fee_month)
      const mine = await subscribe(learner, token, self.id, course.id)
      const theirs = await subscribe(learner, token, child.id, course.id)

      // Занятий не было: возврат — половина взноса.
      expect(await preview(mine.id)).toMatchObject({ reason: 'refusal', lessons_paid: 8, lessons_used: 0 })
      expect(amount((await preview(mine.id)).refund)).toBeCloseTo(fee / 2, 2)

      // Занятие проведено: расчёт прошёл по обеим подпискам, взнос преподавателя — за каждого обучающегося.
      expect(await heldLesson(assignment.id, 1), 'ставка 900 за двоих').toBe(1800)
      const afterFirst = await preview(mine.id)
      expect(afterFirst).toMatchObject({ reason: 'refusal', lessons_paid: 8, lessons_used: 1 })
      // Из восьми оплаченных занятий проведено одно: остаточная стоимость — семь восьмых взноса.
      expect(amount(afterFirst.refund)).toBeCloseTo(fee * 7 / 8 / 2, 2)
      expect(amount(afterFirst.withheld)).toBeCloseTo(fee - amount(afterFirst.refund), 4)

      expect(await heldLesson(assignment.id, 2)).toBe(1800)
      const afterSecond = await preview(mine.id)
      expect(afterSecond.lessons_used).toBe(2)
      expect(amount(afterSecond.refund)).toBeCloseTo(fee * 6 / 8 / 2, 2)

      // Отказ возвращает ровно названное на кошелёк программы.
      const own = await walletOf(token, learner.account, PROGRAM_WALLET)
      const cancelled = (await gql<any>(token, CANCEL_ENROLLMENT, { id: mine.id })).edubridgeCancelEnrollment
      expect(cancelled).toMatchObject({ status: 'CANCELLED', refund_reason: 'refusal' })
      expect(amount(cancelled.refunded_amount)).toBeCloseTo(amount(afterSecond.refund), 4)
      expect(await walletOf(token, learner.account, PROGRAM_WALLET)).toBeCloseTo(own + amount(afterSecond.refund), 4)

      // В группе остался один обучающийся — взнос преподавателя за занятие считается по нему одному.
      expect(await heldLesson(assignment.id, 3)).toBe(900)
      const group = (await groupsOf(course.id))[0]
      expect(group).toMatchObject({ learners_active: 1, lessons_held: 3 })
      // Занятия проведены — дата начала группы закреплена.
      expectCode(await gqlError(chairman, UPDATE_GROUP, { d: { id: group.id, starts_at: dayFromNow(-1) } }), 'EDUBRIDGE_COURSE_START_LOCKED_BY_LESSONS')
      expect(amount((await preview(theirs.id)).refund), 'у оставшейся подписки проведено три занятия из восьми').toBeCloseTo(fee * 5 / 8 / 2, 2)
    })

    it(caseName('edu.teach.side.25', 'фиксированный взнос преподавателя за занятие: сумма одна при любом числе обучающихся'), async () => {
      const { course, assignment } = await runningCourse({ pay_per_learner: false })
      expect((await groupsOf(course.id))[0].pay_per_learner).toBe(false)
      const mine = await subscribe(learner, token, self.id, course.id)
      await subscribe(learner, token, child.id, course.id)

      // Двое обучающихся — взнос преподавателя за занятие тот же, что за одного.
      expect(await heldLesson(assignment.id, 1)).toBe(900)
      expect(await heldLesson(assignment.id, 2)).toBe(900)
      // Оплаченные занятия расходуются у каждого обучающегося одинаково, кто бы ни покрыл взнос преподавателя.
      const fee = amount(course.fee_month)
      expect(amount((await preview(mine.id)).refund)).toBeCloseTo(fee * 6 / 8 / 2, 2)
    })
  })
})
