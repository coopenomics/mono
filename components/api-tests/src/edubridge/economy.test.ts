/**
 * Экономика курса «Образования» снаружи (test-registry/edubridge.economy.yaml).
 *
 * Членский взнос за месяц считает сервер: часы занятий по плановой ставке
 * плюс целевой членский взнос кооператива в процентах. Взнос за весь курс
 * разом — сумма помесячных за месяцы программы со скидкой; скидка ограничена
 * так, чтобы взнос за курс покрывал оплату часов преподавателей.
 *
 * Целевой членский взнос — настройка на весь кооператив: набор ставит 20% и
 * возвращает прежнее значение.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, amount, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  COURSE,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  NO_RIGHTS,
  QUOTE,
  SET_TEACHER_RATE,
  addLearner,
  courseInput,
  createSection,
  dayFromNow,
  educationOff,
  educationOn,
  onboardTeacher,
  publishCourse,
  signOffer,
} from './edubridge.helpers'

const FEE_FIELDS = 'hours_per_month cost_month markup_month fee_month course_months fee_course_base course_discount_amount fee_course cost_course max_course_discount_percent markup_percent'
const FEE_PREVIEW = `query($d:EduCourseEconomyInput!){ edubridgeCourseFeePreview(data:$d){ ${FEE_FIELDS} } }`
const SETTINGS = 'query{ edubridgeEconomySettings{ markup_percent max_course_discount_percent } }'
const SET_SETTINGS = 'mutation($d:EduSetEconomySettingsInput!){ edubridgeSetEconomySettings(data:$d){ markup_percent max_course_discount_percent } }'
const COURSE_ECONOMY = `query($id:ID!){ edubridgeCourseEconomy(course_id:$id){
  plan{ ${FEE_FIELDS} } teachers{ username hourly_rate hours_per_month cost_month } actual_cost_month actual_hours_per_month over_fee
} }`
const COURSE_FEES = 'query($id:ID!){ edubridgeCourse(id:$id){ id fee_month fee_course fee_course_base course_discount_amount course_discount_percent course_months course_payment_enabled } }'
const FUND = 'query{ edubridgeProgramFund{ fund_balance members_balance wallets{ id name available summary } movements{ id title amount direction } } }'
const COURSE_QUOTE = (learnerId: string, courseId: string) => ({ d: { learner_id: learnerId, course_id: courseId, period: 'COURSE' } })

/** Курс набора: восемь занятий в месяц по часу, плановая ставка 1000. */
const BASE = { lessons_per_month: 8, lessons_total: 64, lesson_minutes: 60, planned_hourly_rate: '1000.0000 RUB' }
const MARKUP = 20
const ASSET = /^\d+\.\d{4} RUB$/

describe('Образование: экономика курса — взнос, скидка, срок курса, фонд', () => {
  let chairman = ''
  let section = ''
  let previousMarkup = 30

  const preview = async (over: Record<string, unknown> = {}) =>
    (await gql<any>(chairman, FEE_PREVIEW, { d: { ...BASE, ...over } })).edubridgeCourseFeePreview

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    previousMarkup = (await gql<any>(chairman, SETTINGS)).edubridgeEconomySettings.markup_percent
    await gql(chairman, SET_SETTINGS, { d: { markup_percent: MARKUP } })
  }, 900_000)

  afterAll(async () => {
    await gql(chairman, SET_SETTINGS, { d: { markup_percent: previousMarkup } })
    await educationOff()
  })

  it(caseName('edu.econ.happy.01', 'восемь занятий по часу при ставке 1000 и целевом членском взносе 20% дают взнос 9600 за месяц'), async () => {
    const fee = await preview()
    expect(fee.hours_per_month).toBe(8)
    expect(amount(fee.cost_month)).toBe(8000)
    expect(amount(fee.markup_month)).toBe(1600)
    expect(amount(fee.fee_month)).toBe(9600)
    expect(fee.markup_percent).toBe(MARKUP)
    for (const field of ['cost_month', 'markup_month', 'fee_month']) expect(fee[field], field).toMatch(ASSET)
  })

  it(caseName('edu.econ.happy.02', 'часы считаются из минут расписания: четыре занятия по полтора часа — шесть часов'), async () => {
    const fee = await preview({ lessons_per_month: 4, lessons_total: 32, lesson_minutes: 90 })
    expect(fee.hours_per_month).toBe(6)
    expect(amount(fee.cost_month)).toBe(6000)
    expect(amount(fee.fee_month)).toBe(7200)
  })

  it(caseName('edu.econ.happy.03', 'целевой членский взнос задаётся на весь кооператив, предельная скидка пересчитывается'), async () => {
    const before = (await gql<any>(chairman, SETTINGS)).edubridgeEconomySettings
    expect(before).toEqual({ markup_percent: MARKUP, max_course_discount_percent: 16 })
    try {
      const set = (await gql<any>(chairman, SET_SETTINGS, { d: { markup_percent: 50 } })).edubridgeSetEconomySettings
      expect(set).toEqual({ markup_percent: 50, max_course_discount_percent: 33 })
      expect((await gql<any>(chairman, SETTINGS)).edubridgeEconomySettings).toEqual(set)
      // Новое значение действует на расчёт сразу и для совета тоже.
      const fee = (await gql<any>(await tokenOf(COUNCIL), FEE_PREVIEW, { d: BASE })).edubridgeCourseFeePreview
      expect(amount(fee.fee_month)).toBe(12000)
      expect(fee.max_course_discount_percent).toBe(33)
    }
    finally {
      await gql(chairman, SET_SETTINGS, { d: { markup_percent: MARKUP } })
    }
    expect(amount((await preview()).fee_month)).toBe(9600)
  })

  it(caseName('edu.econ.happy.09', 'длительность курса — программа по месячной нагрузке, неполный месяц считается месяцем'), async () => {
    expect((await preview({ lessons_total: 64 })).course_months).toBe(8)
    expect((await preview({ lessons_total: 72 })).course_months).toBe(9)
    expect((await preview({ lessons_total: 65 })).course_months).toBe(9)
    expect((await preview({ lessons_total: 1 })).course_months).toBe(1)
  })

  it(caseName('edu.econ.happy.10', 'взнос за весь курс разом при скидке 10% — сумма помесячных за месяцы курса минус скидка'), async () => {
    const fee = await preview({ course_payment_enabled: true, course_discount_percent: 10 })
    expect(fee.course_months).toBe(8)
    expect(amount(fee.fee_course_base)).toBe(76800)
    expect(amount(fee.course_discount_amount)).toBe(7680)
    expect(amount(fee.fee_course)).toBe(69120)
    expect(amount(fee.cost_course)).toBe(64000)
  })

  it(caseName('edu.econ.break.01', 'скидка больше предельной отклоняется: взнос за курс оказался бы ниже оплаты часов преподавателей'), async () => {
    const d = courseInput(section, { ...BASE, course_payment_enabled: true, course_discount_percent: 17 })
    expectCode(await gqlError(chairman, CREATE_COURSE, { d }), 'EDUBRIDGE_COURSE_DISCOUNT_TOO_HIGH')
  })

  it(caseName('edu.econ.side.01', 'скидка ровно по пределу принимается, взнос за курс покрывает оплату часов'), async () => {
    const limit = (await gql<any>(chairman, SETTINGS)).edubridgeEconomySettings.max_course_discount_percent
    const d = courseInput(section, { ...BASE, course_payment_enabled: true, course_discount_percent: limit })
    const saved = (await gql<any>(chairman, CREATE_COURSE, { d })).edubridgeCreateCourse
    const fees = (await gql<any>(chairman, COURSE_FEES, { id: saved.id })).edubridgeCourse
    expect(fees.course_discount_percent).toBe(limit)
    expect(amount(fees.fee_course)).toBeGreaterThanOrEqual(64000)
    expect(amount(fees.fee_course)).toBeLessThan(amount(fees.fee_course_base))
  })

  it(caseName('edu.econ.side.03', 'взнос курса приходит из расчёта: произвольной суммы во входных данных нет'), async () => {
    const input = courseInput(section, { ...BASE, course_payment_enabled: true, course_discount_percent: 10 })
    expect(await gqlError(chairman, CREATE_COURSE, { d: { ...input, fee_month: '1.0000 RUB' } }), 'поле суммы взноса не принимается').not.toBeNull()

    const saved = (await gql<any>(chairman, CREATE_COURSE, { d: input })).edubridgeCreateCourse
    const fee = await preview({ course_payment_enabled: true, course_discount_percent: 10 })
    const fees = (await gql<any>(chairman, COURSE_FEES, { id: saved.id })).edubridgeCourse
    expect(fees).toMatchObject({ fee_month: fee.fee_month, fee_course: fee.fee_course, fee_course_base: fee.fee_course_base, course_months: 8, course_discount_percent: 10, course_payment_enabled: true })
  })

  it(caseName('edu.econ.side.05', 'кооператив принимает только помесячный взнос — скидка из формы не проверяется и не действует'), async () => {
    const d = courseInput(section, { ...BASE, course_payment_enabled: false, course_discount_percent: 90 })
    const saved = (await gql<any>(chairman, CREATE_COURSE, { d })).edubridgeCreateCourse
    const fees = (await gql<any>(chairman, COURSE_FEES, { id: saved.id })).edubridgeCourse
    expect(fees).toMatchObject({ course_payment_enabled: false, course_discount_percent: 0, fee_course: null })
    expect(amount(fees.fee_month)).toBe(9600)
    // Полный взнос за программу виден и без взноса разом: восемь месяцев по 9 600.
    expect(amount(fees.fee_course_base)).toBe(76800)
  })

  it(caseName('edu.econ.break.04', 'курс без занятий в программе не сохраняется и не считается'), async () => {
    const d = courseInput(section, { ...BASE, lessons_total: 0, course_payment_enabled: true })
    expectCode(await gqlError(chairman, CREATE_COURSE, { d }), '422')
    expectCode(await gqlError(chairman, FEE_PREVIEW, { d: { ...BASE, lessons_total: 0 } }), '422')
  })

  it(caseName('edu.econ.side.02', 'ставка часа не назначается пайщику без договора преподавателя'), async () => {
    const plain = freshMember({ prefix: 'educ' })
    const d = { username: plain.account, hourly_rate: '1000.0000 RUB' }
    expectCode(await gqlError(chairman, SET_TEACHER_RATE, { d }), 'EDUBRIDGE_TEACHER_CONTRACT_NOT_FOUND')
    expectCode(await gqlError(await login(plain), SET_TEACHER_RATE, { d }), NO_RIGHTS)
  })

  describe('срок взноса за курс', () => {
    let learner: Who
    let token = ''
    let self: any

    beforeAll(async () => {
      learner = freshMember({ prefix: 'edue' })
      token = await login(learner)
      await signOffer(learner, token, 'PARENT')
      self = await addLearner(token, 'Плательщик за курс', true)
    }, 300_000)

    const quote = async (courseId: string) => (await gql<any>(token, QUOTE, COURSE_QUOTE(self.id, courseId))).edubridgeQuote
    const course = (startsInDays: number | null, over: Record<string, unknown> = {}) =>
      publishCourse(chairman, section, startsInDays, { ...BASE, course_payment_enabled: true, course_discount_percent: 10, ...over })

    it(caseName('edu.econ.happy.11', 'курс заканчивается в один день для всех: до начала оплачивается весь курс, в середине — оставшиеся месяцы, после конца оплачивать нечего'), async () => {
      const ahead = await course(30)
      const q = await quote(ahead.id)
      expect(q.months).toBe(8)
      expect(amount(q.base_amount)).toBe(76800)
      expect(amount(q.discount_amount)).toBe(7680)
      expect(amount(q.amount)).toBe(69120)
      // Оплачено до конца программы: восемь месяцев от дня начала занятий.
      const end = new Date(`${dayFromNow(30)}T00:00:00.000Z`)
      end.setMonth(end.getMonth() + 8)
      expect(Math.abs(Date.parse(q.paid_until) - end.getTime())).toBeLessThan(36 * 60 * 60 * 1000)

      // Занятия идут третий месяц: оплачиваются оставшиеся шесть.
      const running = await course(-70)
      const mid = await quote(running.id)
      expect(mid.months).toBe(6)
      expect(amount(mid.base_amount)).toBe(57600)
      expect(amount(mid.amount)).toBe(51840)

      // Программа закончилась: взнос за курс не принимается.
      const finished = await course(-70, { lessons_total: 8 })
      expectCode(await gqlError(token, QUOTE, COURSE_QUOTE(self.id, finished.id)), 'EDUBRIDGE_ENROLLMENT_COURSE_FULLY_PAID')

      // Только помесячный взнос: взнос за курс закрыт, помесячный открыт.
      const monthly = await publishCourse(chairman, section, 30, BASE)
      expectCode(await gqlError(token, QUOTE, COURSE_QUOTE(self.id, monthly.id)), 'EDUBRIDGE_ENROLLMENT_COURSE_PAYMENT_DISABLED')
      expect(amount((await gql<any>(token, QUOTE, { d: { learner_id: self.id, course_id: monthly.id, period: 'MONTH' } })).edubridgeQuote.amount)).toBe(9600)
    })
  })

  describe('план и факт курса, фонд программы', () => {
    let teacher: Who
    let led: any

    beforeAll(async () => {
      teacher = freshMember({ prefix: 'eduf' })
      await onboardTeacher(teacher, await login(teacher), '900.0000 RUB')
      led = await publishCourse(chairman, section, 30, BASE)
      await gql(chairman, CREATE_ASSIGNMENT, { d: { teacher_username: teacher.account, course_id: led.id, period_from: dayFromNow(0), period_to: dayFromNow(240) } })
    }, 600_000)

    it(caseName('edu.econ.happy.04', 'план и факт курса: нагрузка допущенного преподавателя по его ставке укладывается во взнос'), async () => {
      const economy = (await gql<any>(chairman, COURSE_ECONOMY, { id: led.id })).edubridgeCourseEconomy
      expect(amount(economy.plan.fee_month)).toBe(9600)
      expect(amount(economy.plan.cost_month)).toBe(8000)
      expect(economy.teachers).toHaveLength(1)
      expect(economy.teachers[0]).toMatchObject({ username: teacher.account, hours_per_month: 8 })
      expect(amount(economy.teachers[0].cost_month)).toBe(amount(economy.teachers[0].hourly_rate) * 8)
      expect(economy.actual_hours_per_month).toBe(8)
      expect(amount(economy.actual_cost_month)).toBe(amount(economy.teachers[0].cost_month))
      expect(economy.over_fee).toBe(false)

      // Курс без преподавателей: факт пустой.
      const idle = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, BASE) })).edubridgeCreateCourse
      const empty = (await gql<any>(chairman, COURSE_ECONOMY, { id: idle.id })).edubridgeCourseEconomy
      expect(empty.teachers).toEqual([])
      expect(amount(empty.actual_cost_month)).toBe(0)
      expect((await gql<any>(chairman, COURSE, { id: idle.id })).edubridgeCourse.teacher_usernames).toEqual([])
    })

    it(caseName('edu.econ.side.06', 'раздел «Экономика» показывает кошельки программы с остатками; пустой кошелёк показан нулём'), async () => {
      const fund = (await gql<any>(chairman, FUND)).edubridgeProgramFund
      expect(fund.fund_balance).toMatch(ASSET)
      expect(fund.members_balance).toMatch(ASSET)
      expect((fund.wallets as any[]).length, 'свободные средства и резерв — раздельными кошельками').toBeGreaterThanOrEqual(2)
      const ids = (fund.wallets as any[]).map(w => w.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const w of fund.wallets as any[]) {
        expect(w.available, w.id).toMatch(ASSET)
        expect(w.name, w.id).toBeTruthy()
        expect(w.summary, w.id).toBeTruthy()
      }
      // Совет фонд читает, рядовой пайщик — нет.
      expect(await gqlError(await tokenOf(COUNCIL), FUND)).toBeNull()
      expectCode(await gqlError(await login(teacher), FUND), NO_RIGHTS)
    })
  })
})
