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
  CANCEL_ENROLLMENT,
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
  onboardTeacher,
  reportLesson,
  signOffer,
  subscribe,
} from './edubridge.helpers'

const DELETE_COURSE = 'mutation($id:ID!){ edubridgeDeleteCourse(id:$id) }'
const LOCKED = 'EDUBRIDGE_COURSE_FEE_LOCKED_BY_SUBSCRIPTIONS'
const DAY_MS = 24 * 60 * 60 * 1000

describe('Образование: правила курса — удаление, взнос при подписках, оплаченные часы', () => {
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

  it(caseName('edu.admin.break.02', 'при действующих подписках плановая ставка и расписание занятий не меняются; правка без взноса проходит'), async () => {
    const { input, course } = await create({ starts_at: dayFromNow(30) })
    const paid = await subscribe(learner, token, self.id, course.id)
    const update = (over: Record<string, unknown>) => gqlError(chairman, UPDATE_COURSE, { d: { ...input, id: course.id, ...over } })

    expectCode(await update({ planned_hourly_rate: '1200.0000 RUB' }), LOCKED)
    expectCode(await update({ lessons_per_month: 6 }), LOCKED)
    expectCode(await update({ lesson_minutes: 90 }), LOCKED)
    expect((await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse.fee_month, 'взнос прежний').toBe(course.fee_month)
    // Правка, не затрагивающая взнос, проходит.
    expect(await update({ description: 'Описание уточнено', schedule: 'Вт и Чт, 18:00' })).toBeNull()

    // Подписок больше нет — ставка меняется, взнос пересчитывается.
    await gql(token, CANCEL_ENROLLMENT, { id: paid.id })
    expect(await update({ planned_hourly_rate: '1200.0000 RUB' })).toBeNull()
    const repriced = (await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse
    expect(amount(repriced.fee_month)).toBeCloseTo(amount(course.fee_month) * 1.2, 4)
  })

  it(caseName('edu.teach.side.24', 'взнос за занятие — в пределах оплаченного учениками по курсу; без оплаченных часов отчёт не принимается'), async () => {
    // Курс идёт третий день, учеников ещё нет.
    const { course } = await create({ starts_at: dayFromNow(-3), guarantee_days: 0 })
    const assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment
    const report = (n: number) =>
      gqlError(teacherToken, REPORT_LESSON, { d: { assignment_id: assignment.id, lesson_number: n, materials: ['https://example.org/x'], duration_minutes: 120 } })
    expectCode(await report(1), 'EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS')

    // Ученик оплатил месяц: восемь часов по плановой ставке 1000 — чуть больше восьми тысяч.
    await subscribe(learner, token, self.id, course.id)
    const amounts: number[] = []
    for (let n = 1; n <= 4; n++) {
      const r = await reportLesson(teacherToken, assignment.id, n, { duration_minutes: 120, held_at: new Date(Date.now() - DAY_MS).toISOString() })
      amounts.push(amount(r.contribution.amount))
    }
    expect(amounts, 'сдвоенное занятие по ставке 900').toEqual([1800, 1800, 1800, 1800])

    // Пятое сдвоенное занятие целиком в оплаченное не помещается — взнос урезан до остатка.
    const fifth = amount((await reportLesson(teacherToken, assignment.id, 5, { duration_minutes: 120 })).contribution.amount)
    expect(fifth).toBeGreaterThan(0)
    expect(fifth).toBeLessThan(1800)
    const total = amounts.reduce((a, b) => a + b, 0) + fifth
    expect(total, 'не больше стоимости оплаченных часов по плановой ставке').toBeLessThanOrEqual(8000 * 31 / 30 + 1)
    expect(total).toBeGreaterThanOrEqual(8000 * 28 / 30 - 1)
    // Оплаченное исчерпано: следующий отчёт не принимается.
    expectCode(await report(6), 'EDUBRIDGE_LESSON_NOT_PAID_BY_LEARNERS')
  })
})
