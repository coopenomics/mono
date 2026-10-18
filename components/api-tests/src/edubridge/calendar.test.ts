/**
 * Календарь занятий группы и стол преподавателя снаружи
 * (test-registry/edubridge.calendar.yaml, edubridge.teacher.yaml).
 *
 * Календарь строится из окон расписания группы на всю программу; занятия сверх
 * расписания берутся только из резерва; отмена освобождает номер. Стол
 * преподавателя показывает сумму взноса до отчёта, отчёты принимаются в любой
 * очерёдности, длительность уходит в цепь из календаря, совет получает
 * сведения о взносе по ключу из заявления.
 *
 * Даты стенда плавают, поэтому проверки относительные: дни недели и время по
 * Москве, порядок номеров по датам, соотношение сроков без длины суток стенда.
 *
 * Два курса начались три дня назад, у обоих по обучающемуся с оплаченным
 * доступом. Курс календаря ведут два преподавателя; курс отчётов — один, без
 * окон по дням (только резерв), его занятия назначаются отдельно.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  CANCEL_LESSON,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  GROUP_LESSONS,
  MOVE_LESSON,
  MY_LESSONS,
  PLANNED_RATE,
  PLAN_LESSON,
  REPORT_LESSON,
  SET_COURSE_STATUS,
  SET_GROUP_SCHEDULE,
  addLearner,
  approveContract,
  courseInput,
  createSection,
  dayFromNow,
  educationOff,
  educationOn,
  fundShare,
  groupOfAssignment,
  onboardTeacher,
  pendingContractApproval,
  planLesson,
  reopenEnrollment,
  signOffer,
  subscribe,
} from './edubridge.helpers'

const RATE = '900.0000 RUB'
const BRIEF = `query($h:String!){ edubridgeContributionBrief(rid_hash:$h){
  amount course_title group_title lesson_number lesson_topic duration_minutes learners_count hourly_rate } }`
const CREATE_GROUP = 'mutation($d:EduCreateGroupInput!){ edubridgeCreateGroup(data:$d){ id status starts_at } }'
const FINISH_GROUP = 'mutation($id:ID!){ edubridgeFinishGroup(group_id:$id){ id status } }'
const MY_CONTRIBUTIONS = 'query{ edubridgeMyContributions{ id rid_hash } }'
const MY_LESSONS_CHARGE = 'query{ edubridgeMyLessons{ id group_id expected_amount contribution_id } }'
const TEACHERS_APPROVALS = 'query{ edubridgeTeachers{ username pending_approvals } }'

/** День недели (1 — понедельник … 7 — воскресенье), час и минуты по Москве. */
function moscow(at: string | Date): { weekday: number, hour: number, minute: number, date: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at)).map(p => [p.type, p.value]))
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return { weekday: weekdays[parts.weekday], hour: Number(parts.hour), minute: Number(parts.minute), date: `${parts.year}-${parts.month}-${parts.day}` }
}

const slot = (weekday: number, time: string, assignmentId: string | null, minutes = 60) =>
  ({ weekday, time, minutes, assignment_id: assignmentId, hourly_rate: PLANNED_RATE })
const RESERVE = { weekday: 8, time: '', minutes: 60, assignment_id: null, hourly_rate: PLANNED_RATE }

describe('Образование: календарь группы и стол преподавателя', () => {
  let chairman = ''
  let teacher: Who
  let token = ''
  let other: Who
  let calendarCourse: any
  let reportCourse: any
  let alienCourse: any
  let calA: any
  let calB: any
  let repA: any
  let alienA: any
  let group: any
  let reportGroup: any

  const lessons = async (groupId = group.id) =>
    ((await gql<any>(token, GROUP_LESSONS, { id: groupId })).edubridgeGroupLessons as any[])
  const live = async (groupId?: string) => (await lessons(groupId)).filter(l => l.status !== 'CANCELLED')
  const setSchedule = async (slots: unknown[], reportDays = 7, groupId = group.id) =>
    (await gql<any>(chairman, SET_GROUP_SCHEDULE, { d: { group_id: groupId, slots, report_days: reportDays } })).edubridgeSetGroupSchedule

  const publish = async (section: string) => {
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { starts_at: dayFromNow(-3), guarantee_days: 0 }) })).edubridgeCreateCourse
    await reopenEnrollment(chairman, created.id)
    return (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
  }
  const admit = async (courseId: string, who: Who) =>
    (await gql<any>(chairman, CREATE_ASSIGNMENT, {
      d: { teacher_username: who.account, course_id: courseId, period_from: dayFromNow(-10), period_to: dayFromNow(120) },
    })).edubridgeCreateAssignment

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    const section = await createSection(chairman)
    calendarCourse = await publish(section)
    reportCourse = await publish(section)
    alienCourse = await publish(section)

    teacher = freshMember({ prefix: 'educ' })
    token = await login(teacher)
    await onboardTeacher(teacher, token, RATE)
    other = freshMember({ prefix: 'edud' })
    await onboardTeacher(other, await login(other), RATE)

    calA = await admit(calendarCourse.id, teacher)
    calB = await admit(calendarCourse.id, other)
    repA = await admit(reportCourse.id, teacher)
    alienA = await admit(alienCourse.id, other)

    const learner = freshMember({ prefix: 'edue' })
    const learnerToken = await login(learner)
    await signOffer(learner, learnerToken, 'PARENT')
    const self = await addLearner(learnerToken, 'Ученик календаря', true)
    await fundShare(learner, learnerToken, amount(calendarCourse.fee_month) * 3)
    await subscribe(learner, learnerToken, self.id, calendarCourse.id)
    await subscribe(learner, learnerToken, self.id, reportCourse.id)

    group = (await groupOfAssignment(token, calA.id)).group
    reportGroup = (await groupOfAssignment(token, repA.id)).group
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  describe('календарь по окнам расписания', () => {
    it(caseName('edu.cal.happy.01', 'окна «Вт, Чт 17:00»: календарь на всю программу, первое занятие — ближайший вторник или четверг от начала, номера по датам'), async () => {
      await setSchedule([slot(2, '17:00', calA.id), slot(4, '17:00', calA.id)])
      const scheduled = (await live()).filter(l => l.origin === 'SCHEDULE').sort((a, b) => +new Date(a.held_at) - +new Date(b.held_at))
      expect(scheduled.length).toBeGreaterThan(0)
      for (const l of scheduled)
      {
        const at = moscow(l.held_at)
        expect({ hour: at.hour, minute: at.minute }).toEqual({ hour: 17, minute: 0 })
        expect([2, 4]).toContain(at.weekday)
      }
      expect(scheduled.map(l => l.lesson_number)).toEqual([...scheduled.map(l => l.lesson_number)].sort((a, b) => a - b))
      expect(new Set(scheduled.map(l => l.teacher_username))).toEqual(new Set([teacher.account]))

      // Первое занятие — первый вторник или четверг с дня начала группы.
      const start = new Date(group.starts_at)
      let day = start
      while (![2, 4].includes(moscow(day).weekday)) day = new Date(day.getTime() + 86_400_000)
      expect(moscow(scheduled[0].held_at).date).toBe(moscow(day).date)
    })

    it(caseName('edu.cal.side.04', 'срок на отчёт и конец занятия сжаты одинаково: отношение сроков равно отношению суток к длительности'), async () => {
      const reportDays = 7
      await setSchedule([slot(2, '17:00', calA.id), slot(4, '17:00', calA.id)], reportDays)
      const lesson = (await live()).find(l => l.origin === 'SCHEDULE')
      const lessonMs = +new Date(lesson.ends_at) - +new Date(lesson.held_at)
      const reportMs = +new Date(lesson.report_until) - +new Date(lesson.ends_at)
      expect(lessonMs).toBeGreaterThan(0)
      expect(reportMs / lessonMs).toBeCloseTo(reportDays * 1440 / lesson.duration_minutes, 3)
    })

    it(caseName('edu.cal.side.20', 'окна без преподавателя получают действующие допуски курса по очереди'), async () => {
      const saved = await setSchedule([slot(2, '17:00', null), slot(4, '17:00', null)])
      expect(saved.schedule_slots.map((s: any) => s.assignment_id).sort()).toEqual([calA.id, calB.id].sort())
      const planned = (await live()).filter(l => l.origin === 'SCHEDULE')
      expect(planned.every(l => l.assignment_id)).toBe(true)
      expect(new Set(planned.map(l => l.teacher_username))).toEqual(new Set([teacher.account, other.account]))
    })

    it(caseName('edu.cal.break.01', 'окно с допуском другого курса отклоняется'), async () => {
      expectCode(await gqlError(chairman, SET_GROUP_SCHEDULE, { d: { group_id: group.id, slots: [slot(1, '10:00', alienA.id)] } }), 'EDUBRIDGE_SCHEDULE_TEACHER_NOT_ASSIGNED')
    })
  })

  describe('занятия сверх расписания и перестройка', () => {
    let extra: any

    it(caseName('edu.cal.side.03', 'отмена запланированного занятия освобождает номер: следующее внеочередное получает его'), async () => {
      await setSchedule([slot(2, '17:00', calA.id), slot(4, '17:00', calA.id), RESERVE])
      const first = (await gql<any>(chairman, PLAN_LESSON, { d: { group_id: group.id, assignment_id: calA.id, held_at: dayFromNow(5), minutes: 60 } })).edubridgePlanLesson
      expect(first).toMatchObject({ origin: 'EXTRA', status: 'PLANNED' })
      const cancelled = (await gql<any>(chairman, CANCEL_LESSON, { id: first.id })).edubridgeCancelLesson
      expect(cancelled.status).toBe('CANCELLED')
      const next = (await gql<any>(chairman, PLAN_LESSON, { d: { group_id: group.id, assignment_id: calA.id, held_at: dayFromNow(6), minutes: 60 } })).edubridgePlanLesson
      expect(next.lesson_number).toBe(first.lesson_number)
      expect((await lessons()).find(l => l.id === first.id)?.status).toBe('CANCELLED')
      extra = next
    })

    it(caseName('edu.cal.side.01', 'перестройка после смены окон: назначенное отдельно занятие остаётся, по расписанию строится заново'), async () => {
      const before = (await live()).filter(l => l.origin === 'SCHEDULE').length
      await setSchedule([slot(2, '18:00', calA.id), slot(4, '18:00', calA.id), RESERVE])
      const after = await live()
      expect(after.find(l => l.id === extra.id), 'назначенное отдельно занятие на месте').toBeTruthy()
      const scheduled = after.filter(l => l.origin === 'SCHEDULE')
      expect(scheduled.length).toBeLessThanOrEqual(before)
      for (const l of scheduled)
        expect(moscow(l.held_at).hour).toBe(18)
    })

    it(caseName('edu.cal.side.02', 'внеочередные занятия только из резерва: расписание не трогается, резерв исчерпан — отказ'), async () => {
      const scheduledBefore = (await live()).filter(l => l.origin === 'SCHEDULE').length
      let refusal = null
      for (let i = 0; i < 40 && !refusal; i++) {
        refusal = await gqlError(chairman, PLAN_LESSON, { d: { group_id: group.id, assignment_id: calA.id, held_at: dayFromNow(7 + i), minutes: 240 } })
      }
      expectCode(refusal, 'EDUBRIDGE_RESERVE_EMPTY')
      expect((await live()).filter(l => l.origin === 'SCHEDULE').length).toBe(scheduledBefore)
    }, 300_000)

    it(caseName('edu.cal.break.01', 'резерв исчерпан: перенос с удлинением отклоняется'), async () => {
      expectCode(await gqlError(chairman, MOVE_LESSON, { d: { lesson_id: extra.id, minutes: 600 } }), 'EDUBRIDGE_RESERVE_EMPTY')
    })
  })

  describe('стол преподавателя: отчёты и сумма до отчёта', () => {
    let third: any
    let first: any

    it(caseName('edu.teach.happy.33', 'у занятия без отчёта видна сумма взноса до отчёта: ставка допуска за минуты на обучающегося'), async () => {
      first = await planLesson(reportGroup.id, { assignment_id: repA.id, held_at: new Date(Date.now() - 6 * 3600_000).toISOString(), minutes: 60 })
      const mine = ((await gql<any>(token, MY_LESSONS_CHARGE)).edubridgeMyLessons as any[]).find(l => l.id === first.id)
      expect(mine.expected_amount).toBeTruthy()
      expect(amount(mine.expected_amount)).toBeCloseTo(900, 4)
    })

    it(caseName('edu.teach.side.30', 'отчёты принимаются в любой очерёдности: третье занятие раньше первого'), async () => {
      await planLesson(reportGroup.id, { assignment_id: repA.id, held_at: new Date(Date.now() - 5 * 3600_000).toISOString(), minutes: 60 })
      third = await planLesson(reportGroup.id, { assignment_id: repA.id, held_at: new Date(Date.now() - 4 * 3600_000).toISOString(), minutes: 60 })
      expect(third.lesson_number).toBeGreaterThan(first.lesson_number)

      const reportedThird = (await gql<any>(token, REPORT_LESSON, { d: { lesson_id: third.id, materials: ['https://example.org/l3'], topic: 'Третье занятие' } })).edubridgeReportLesson
      expect(reportedThird.reported_at).toBeTruthy()
      const reportedFirst = (await gql<any>(token, REPORT_LESSON, { d: { lesson_id: first.id, materials: ['https://example.org/l1'], topic: 'Первое занятие' } })).edubridgeReportLesson
      expect(reportedFirst.reported_at).toBeTruthy()
    })

    it(caseName('edu.teach.side.31', 'двухчасовое занятие календаря: длительность в отчёте не называется, уходит из календаря'), async () => {
      const long = await planLesson(reportGroup.id, { assignment_id: repA.id, held_at: new Date(Date.now() - 8 * 3600_000).toISOString(), minutes: 120 })
      const reported = (await gql<any>(token, REPORT_LESSON, { d: { lesson_id: long.id, materials: ['https://example.org/long'], topic: 'Двухчасовое занятие' } })).edubridgeReportLesson
      expect(reported.duration_minutes).toBe(120)
    })

    it(caseName('edu.teach.happy.30', 'совет получает сведения о взносе по ключу из заявления: курс, группа, занятие, тема, длительность, обучающиеся'), async () => {
      const reported = ((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).find(l => l.id === third.id)
      const contribution = ((await gql<any>(token, MY_CONTRIBUTIONS)).edubridgeMyContributions as any[]).find(c => c.id === reported.contribution_id)
      expect(contribution?.rid_hash).toBeTruthy()
      const brief = (await gql<any>(chairman, BRIEF, { h: contribution.rid_hash })).edubridgeContributionBrief
      expect(brief).toMatchObject({
        course_title: reportCourse.title,
        lesson_number: third.lesson_number,
        lesson_topic: 'Третье занятие',
        duration_minutes: 60,
        learners_count: 1,
      })
      expect(brief.group_title).toBeTruthy()
    })

    it(caseName('edu.teach.side.32', 'сведения по неизвестному ключу — пустой ответ'), async () => {
      expect((await gql<any>(chairman, BRIEF, { h: 'f'.repeat(64) })).edubridgeContributionBrief).toBeNull()
    })
  })

  describe('группа без обучающихся и завершённая группа', () => {
    let emptyGroup: any

    it(caseName('edu.cal.side.22', 'прошедшее занятие группы без оплаченных обучающихся: обучающихся ноль, просрочки нет, отчёта не ждут'), async () => {
      emptyGroup = (await gql<any>(chairman, CREATE_GROUP, { d: { course_id: reportCourse.id, starts_at: dayFromNow(-3), title: 'Группа без обучающихся' } })).edubridgeCreateGroup
      const lesson = await planLesson(emptyGroup.id, { assignment_id: repA.id, held_at: new Date(Date.now() - 3 * 3600_000).toISOString(), minutes: 60 })
      // Число обучающихся и просрочку считает стол преподавателя.
      const row = ((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).find(l => l.id === lesson.id)
      expect(row.learners_count).toBe(0)
      expect(row.overdue).toBe(false)
    })

    it(caseName('edu.teach.side.34', 'без обучающихся сумма за занятие не показывается: посчитать нечем'), async () => {
      const mine = ((await gql<any>(token, MY_LESSONS_CHARGE)).edubridgeMyLessons as any[]).filter(l => l.group_id === emptyGroup.id)
      expect(mine.length).toBeGreaterThan(0)
      for (const l of mine)
        expect(l.expected_amount).toBeNull()
    })

    it(caseName('edu.cal.side.21', 'группа завершена: запланированные занятия отменяются и отчёта не ждут'), async () => {
      // Завершить можно группу без действующих подписок — это группа без обучающихся.
      await planLesson(emptyGroup.id, { assignment_id: repA.id, held_at: dayFromNow(10), minutes: 60 })
      expect((await live(emptyGroup.id)).length).toBeGreaterThan(0)
      await gql(chairman, FINISH_GROUP, { id: emptyGroup.id })
      const after = await lessons(emptyGroup.id)
      for (const l of after.filter(x => !x.reported_at))
        expect(l.status, `занятие ${l.lesson_number}`).toBe('CANCELLED')
      const mine = ((await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]).filter(l => l.group_id === emptyGroup.id && !l.reported_at)
      for (const l of mine)
        expect(l.overdue, `отчёта по занятию ${l.lesson_number} не ждут`).toBe(false)
    })
  })

  describe('реестр преподавателей', () => {
    it(caseName('edu.teach.happy.35', 'у преподавателя видно, какие его документы ждут подписи председателя'), async () => {
      const newcomer = freshMember({ prefix: 'eduf' })
      await onboardTeacher(newcomer, await login(newcomer), RATE, { approve: false })
      const row = ((await gql<any>(chairman, TEACHERS_APPROVALS)).edubridgeTeachers as any[]).find(t => t.username === newcomer.account)
      expect(row?.pending_approvals?.length).toBeGreaterThan(0)
      const approval = await pendingContractApproval(newcomer.account)
      if (approval)
        await approveContract(approval)
    })
  })
})
