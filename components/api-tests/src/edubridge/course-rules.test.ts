/**
 * Правила курса «Образования» снаружи (test-registry/edubridge.admin.yaml,
 * edubridge.teacher.yaml): удаление курса, запрет менять взнос при действующих
 * подписках, сумма взноса преподавателя в пределах оплаченного по курсу.
 *
 * Преподаватель получает за часы, оплаченные учениками этого курса: отчёт о
 * занятии сверх оплаченного урезается, без оплаченных часов не принимается —
 * средства других курсов на него не идут.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  COURSE,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  MY_ASSIGNMENTS,
  NO_RIGHTS,
  REPORT_LESSON,
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
  quoteOf,
  reportLesson,
  reopenEnrollment,
  signOffer,
  subscribe,
} from './edubridge.helpers'

const DELETE_COURSE = 'mutation($id:ID!){ edubridgeDeleteCourse(id:$id) }'

describe('Образование: правила курса — удаление, условия при подписках, оплата занятий', () => {
  let chairman = ''
  let section = ''
  let learner: Who
  let token = ''
  let self: any
  let child: any
  let teacher: Who
  let teacherToken = ''

  const create = async (over: Record<string, unknown> = {}, publish = true) => {
    const input = courseInput(section, over)
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: input })).edubridgeCreateCourse
    if (hasStarted(input)) await reopenEnrollment(chairman, created.id)
    const course = publish
      ? (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
      : created
    return { input, course }
  }

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    learner = freshMember({ prefix: 'eduo' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    self = await addLearner(token, 'Ученик правил курса', true)
    child = await addLearner(token, 'Второй обучающийся')
    await fundShare(learner, token, 60_000)
    teacher = freshMember({ prefix: 'edub' })
    teacherToken = await login(teacher)
    await onboardTeacher(teacher, teacherToken, '900.0000 RUB')
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.admin.side.17', 'курс без подписок и занятий удаляется вместе с допусками; при подписках удаление отклоняется'), async () => {
    const { course: idle } = await create({ starts_at: dayFromNow(30), teacher_usernames: [teacher.account] }, false)
    const assigned = async () => ((await gql<any>(teacherToken, MY_ASSIGNMENTS)).edubridgeMyAssignments as any[]).filter(a => a.course_id === idle.id)
    expect(await assigned()).toHaveLength(1)

    expectCode(await gqlError(token, DELETE_COURSE, { id: idle.id }), NO_RIGHTS)
    expect((await gql<any>(chairman, DELETE_COURSE, { id: idle.id })).edubridgeDeleteCourse).toBe(true)
    expectCode(await gqlError(chairman, COURSE, { id: idle.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')
    expect(await assigned(), 'допуск к удалённому курсу снят').toEqual([])
    expectCode(await gqlError(chairman, DELETE_COURSE, { id: idle.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')

    const { course: taken } = await create({ starts_at: dayFromNow(30) })
    await subscribe(learner, token, child.id, taken.id)
    expectCode(await gqlError(chairman, DELETE_COURSE, { id: taken.id }), 'EDUBRIDGE_COURSE_DELETE_HAS_SUBSCRIPTIONS')
    expect((await gql<any>(chairman, COURSE, { id: taken.id })).edubridgeCourse.status, 'курс остался как был').toBe('PUBLISHED')
  })

  it(caseName('edu.admin.break.02', 'при действующих подписках условия курса правятся для новых групп; взнос идущей группы прежний'), async () => {
    const { input, course } = await create({ starts_at: dayFromNow(30) })
    await subscribe(learner, token, self.id, course.id)
    const update = (over: Record<string, unknown>) => gqlError(chairman, UPDATE_COURSE, { d: { ...input, id: course.id, ...over } })

    // Плановая ставка курса меняется: взнос курса пересчитан.
    expect(await update({ planned_hourly_rate: '1200.0000 RUB' })).toBeNull()
    const repriced = (await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse
    expect(amount(repriced.fee_month)).toBeGreaterThan(amount(course.fee_month))
    // Обучающийся идущей группы продлевает подписку по прежнему взносу: её условия закреплены.
    const extension = await quoteOf(token, self.id, course.id)
    expect(extension.is_extension).toBe(true)
    expect(amount(extension.amount)).toBeCloseTo(amount(course.fee_month), 4)
    // Правка описания и расписания проходит как прежде.
    expect(await update({ planned_hourly_rate: '1200.0000 RUB', description: 'Описание уточнено', schedule: 'Вт и Чт, 18:00' })).toBeNull()
  })

  it(caseName('edu.teach.side.24', 'взнос за занятие — в пределах оплаченных занятий подписки; без оплаченного доступа отчёт не принимается'), async () => {
    // Курс идёт третий день, учеников ещё нет.
    const { course } = await create({ starts_at: dayFromNow(-3), guarantee_days: 0 })
    const assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment
    const report = (n: number) =>
      gqlError(teacherToken, REPORT_LESSON, { d: { assignment_id: assignment.id, lesson_number: n, materials: ['https://example.org/x'] } })
    expectCode(await report(1), 'EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS')

    // Ученик оплатил месяц — восемь занятий. Каждое отчитывается отдельно, взнос — по ставке 900 за занятие.
    await subscribe(learner, token, self.id, course.id)
    const amounts: number[] = []
    for (let n = 1; n <= 8; n++) {
      const r = await reportLesson(teacherToken, assignment.id, n)
      await holdMaterials(teacher, teacherToken, r.contribution.id)
      amounts.push(amount(r.contribution.amount))
    }
    expect(amounts).toEqual(Array.from({ length: 8 }, () => 900))
    // Оплаченные занятия исчерпаны: девятый отчёт не принимается.
    expectCode(await report(9), 'EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS')
  }, 600_000)
})
