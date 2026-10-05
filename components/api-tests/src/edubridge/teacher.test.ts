/**
 * Подключение преподавателя программы «Образование» снаружи
 * (test-registry/edubridge.teacher.yaml, edubridge.desktop-gating.yaml).
 *
 * Преподаватель называет ставку и рассказывает о себе, подписывает оферту
 * преподавателя и договор участия в хозяйственной деятельности. Договор
 * двухподписный: вторую подпись ставит председатель со стола одобрений. До
 * своей подписи на договоре пайщик со столом преподавателя не работает — у
 * него одно право подключения. Действующего преподавателя администратор
 * допускает к курсу, если плановая ставка курса покрывает ставку преподавателя.
 *
 * Преподаватель — свежий пайщик: договор и ставка у него одни на прогон.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, caseName, expectCode, freshMember, gql, gqlError, login, tokenOf, waitFor } from '../core'
import {
  COURSE,
  CREATE_ASSIGNMENT,
  CREATE_COURSE,
  MY_ASSIGNMENTS,
  MY_CONTRACT,
  MY_PROFILE,
  NO_RIGHTS,
  SAVE_PROFILE,
  SIGN_CONTRACT,
  TEACHERS,
  UPDATE_COURSE,
  approveContract,
  courseInput,
  createSection,
  dayFromNow,
  deskGrants,
  educationOff,
  educationOn,
  offersState,
  pendingContractApproval,
  publishCourse,
  signOffer,
  signedContract,
} from './edubridge.helpers'

/** Ставка преподавателя ниже плановой ставки курсов набора. */
const RATE = '900.0000 RUB'
/** Права стола преподавателя: назначения, взносы результатами, расчёт. */
const TEACHER_DESK = ['EduAssignment:read:own', 'EduContribution:read:own', 'EduContribution:create:own', 'EduTeacherWallet:read:own']

describe('Образование: преподаватель — профиль, оферта, договор, допуск к курсу', () => {
  let chairman = ''
  let teacher: Who
  let token = ''
  let outsider: Who
  let outsiderToken = ''
  let section = ''
  let course: any
  let contract: any

  const assignmentsOf = async (): Promise<any[]> => (await gql<any>(token, MY_ASSIGNMENTS)).edubridgeMyAssignments

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    course = await publishCourse(chairman, section, 30)
    teacher = freshMember({ prefix: 'edut' })
    token = await login(teacher)
    outsider = freshMember({ prefix: 'eduo' })
    outsiderToken = await login(outsider)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.teach.happy.profile-01', 'первый шаг подключения: пайщик без оферты и договора называет ставку и рассказывает о себе'), async () => {
    const saved = (await gql<any>(token, SAVE_PROFILE, { d: { about: 'Веду математику, десять лет в школе', hourly_rate: RATE } })).edubridgeSaveTeacherProfile
    expect(saved).toEqual({ about: 'Веду математику, десять лет в школе', hourly_rate: RATE, rate_locked: false })
    expect((await gql<any>(token, MY_PROFILE)).edubridgeMyTeacherProfile).toEqual(saved)

    // Рассказ о себе правится без повторного ввода ставки.
    const edited = (await gql<any>(token, SAVE_PROFILE, { d: { about: 'Веду математику и физику' } })).edubridgeSaveTeacherProfile
    expect(edited).toEqual({ about: 'Веду математику и физику', hourly_rate: RATE, rate_locked: false })
  })

  it(caseName('edu.gating.side.02', 'оферта преподавателя подписана, договор ещё нет — стол преподавателя закрыт, открыто только подключение'), async () => {
    // Без оферты договор не подписать и не прочитать.
    const early = await signedContract(teacher, token)
    expectCode(await gqlError(token, SIGN_CONTRACT, { d: early }), 'EDUBRIDGE_TEACHER_OFFER_REQUIRED')
    expectCode(await gqlError(token, MY_CONTRACT), 'EDUBRIDGE_TEACHER_OFFER_REQUIRED')

    const state = await signOffer(teacher, token, 'TEACHER')
    expect(state.teacher).toMatchObject({ kind: 'TEACHER', requires_gate: false, source: 'AGREEMENT_SIGNED' })
    expect((await offersState(token)).parent.source, 'оферта ученика — отдельная подпись').toBe('GATE_REQUIRED')

    const grants = await deskGrants(token)
    expect(grants).toContain('Onboarding:teacher')
    for (const right of TEACHER_DESK) expect(grants, right).not.toContain(right)
    expectCode(await gqlError(token, MY_ASSIGNMENTS), NO_RIGHTS)
    expect((await gql<any>(token, MY_CONTRACT)).edubridgeMyContract).toBeNull()
  })

  it(caseName('edu.catalog.side.05', 'пайщика без договора преподавателем курса не записать'), async () => {
    const withStranger = courseInput(section, { teacher_usernames: [teacher.account] })
    expectCode(await gqlError(chairman, CREATE_COURSE, { d: withStranger }), 'EDUBRIDGE_COURSE_TEACHERS_WITHOUT_CONTRACT')
  })

  it('пайщика без договора администратор к курсу не допускает', async () => {
    // Форма курса отказывает преподавателю без договора; прямой допуск обязан отказать так же.
    const probe = await publishCourse(chairman, section, 30)
    const admit = { d: { teacher_username: outsider.account, course_id: probe.id, period_from: dayFromNow(0), period_to: dayFromNow(90) } }
    const err = await gqlError(chairman, CREATE_ASSIGNMENT, admit)
    expect(err, 'допуск к курсу без договора отклонён').not.toBeNull()
    expect((await gql<any>(chairman, COURSE, { id: probe.id })).edubridgeCourse.teacher_usernames).toEqual([])
  })

  it(caseName('edu.teach.side.02', 'договор двухподписный: после подписи преподавателя ждёт председателя, после его подписи действует'), async () => {
    const { document, contract_number } = await signedContract(teacher, token)
    contract = (await gql<any>(token, SIGN_CONTRACT, { d: { document, contract_number } })).edubridgeSignContract
    expect(contract).toMatchObject({ contract_number, status: 'PENDING_APPROVAL', hourly_rate: RATE, approved_at: null })
    expect(contract.contract_hash.toLowerCase()).toBe(String(document.hash).toLowerCase())

    // Своя подпись на договоре открывает стол преподавателя.
    const grants = await deskGrants(token)
    expect(grants).toEqual(expect.arrayContaining(TEACHER_DESK))
    expect(grants).not.toContain('Onboarding:teacher')
    expect(await assignmentsOf()).toEqual([])

    const approval = await waitFor(() => pendingContractApproval(teacher.account),
      { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор преподавателя на столе одобрений председателя' })
    expect(approval.document.document.signatures.map((s: any) => s.signer)).toEqual([teacher.account])
    await approveContract(approval)

    const active = await waitFor(async () => {
      const c = (await gql<any>(token, MY_CONTRACT)).edubridgeMyContract
      return c?.status === 'ACTIVE' ? c : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор преподавателя действует' })
    expect(active).toMatchObject({ contract_number, contract_hash: contract.contract_hash, hourly_rate: RATE })
    expect(active.approved_at, 'дата подписи председателя').toBeTruthy()
    expect(await pendingContractApproval(teacher.account), 'одобрение закрыто').toBeUndefined()
  })

  it(caseName('edu.teach.break.profile-01', 'пустой рассказ о себе, неназванная либо нулевая ставка и смена ставки после договора отклоняются'), async () => {
    expectCode(await gqlError(outsiderToken, SAVE_PROFILE, { d: { about: '   ', hourly_rate: RATE } }), 'EDUBRIDGE_TEACHER_ABOUT_REQUIRED')
    expectCode(await gqlError(outsiderToken, SAVE_PROFILE, { d: { about: 'Без ставки' } }), 'EDUBRIDGE_TEACHER_RATE_REQUIRED')
    expectCode(await gqlError(outsiderToken, SAVE_PROFILE, { d: { about: 'Нулевая ставка', hourly_rate: '0.0000 RUB' } }), 'EDUBRIDGE_TEACHER_RATE_REQUIRED')
    expect((await gql<any>(outsiderToken, MY_PROFILE)).edubridgeMyTeacherProfile.about).toBe('')

    // Ставка закреплена договором: преподаватель сам её не меняет.
    expectCode(await gqlError(token, SAVE_PROFILE, { d: { about: 'Хочу другую ставку', hourly_rate: '950.0000 RUB' } }), 'EDUBRIDGE_TEACHER_RATE_ALREADY_SET')
    expect((await gql<any>(token, MY_PROFILE)).edubridgeMyTeacherProfile).toMatchObject({ about: 'Веду математику и физику', hourly_rate: RATE, rate_locked: true })
  })

  it(caseName('edu.teach.happy.06', 'администратор видит преподавателя в списке с договором и ставкой'), async () => {
    const list = (await gql<any>(chairman, TEACHERS)).edubridgeTeachers as any[]
    const row = list.find(t => t.username === teacher.account)
    expect(row, 'преподаватель в списке кооператива').toBeTruthy()
    expect(row).toMatchObject({ contract_number: contract.contract_number, contract_status: 'ACTIVE', hourly_rate: RATE, about: 'Веду математику и физику' })
    expect(list.map(t => t.username)).not.toContain(outsider.account)
    expectCode(await gqlError(token, TEACHERS), NO_RIGHTS)
  })

  it(caseName('edu.teach.side.03', 'администратор допускает преподавателя к курсу — назначение действует сразу и видно на его столе'), async () => {
    const d = { teacher_username: teacher.account, course_id: course.id, period_from: dayFromNow(0), period_to: dayFromNow(90) }
    const assignment = (await gql<any>(chairman, CREATE_ASSIGNMENT, { d })).edubridgeCreateAssignment
    expect(assignment).toMatchObject({ teacher_username: teacher.account, course_id: course.id, course_title: course.title, status: 'ACTIVE' })
    // Нагрузка по умолчанию — всё расписание курса.
    expect(assignment.minutes_per_month).toBe(course.lessons_per_month * 60)

    const mine = await assignmentsOf()
    expect(mine.map(a => a.id)).toEqual([assignment.id])
    expect((await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse.teacher_usernames).toEqual([teacher.account])
    // Допускает администратор, не сам преподаватель.
    expectCode(await gqlError(token, CREATE_ASSIGNMENT, { d }), NO_RIGHTS)
  })

  it(caseName('edu.teach.side.18', 'курс с плановой ставкой ниже ставки преподавателя его не принимает'), async () => {
    const cheap = await publishCourse(chairman, section, 30, { planned_hourly_rate: '500.0000 RUB' })
    const admit = { d: { teacher_username: teacher.account, course_id: cheap.id, period_from: dayFromNow(0), period_to: dayFromNow(90) } }
    expectCode(await gqlError(chairman, CREATE_ASSIGNMENT, admit), 'EDUBRIDGE_TEACHER_RATE_NOT_COVERED')
    expect((await assignmentsOf()).map(a => a.course_id)).not.toContain(cheap.id)
  })

  it(caseName('edu.teacher.break.sync-01', 'курс не сохраняется с преподавателем, чья ставка выше плановой ставки курса'), async () => {
    const input = courseInput(section, { planned_hourly_rate: '500.0000 RUB', teacher_usernames: [teacher.account] })
    expectCode(await gqlError(chairman, CREATE_COURSE, { d: input }), 'EDUBRIDGE_COURSE_TEACHER_RATE_NOT_COVERED')
  })

  let led: any
  let ledInput: Record<string, unknown>

  it(caseName('edu.teacher.happy.sync-01', 'преподаватель, записанный в курс при сохранении, сразу получает допуск'), async () => {
    ledInput = courseInput(section, { teacher_usernames: [teacher.account], starts_at: dayFromNow(30) })
    led = (await gql<any>(chairman, CREATE_COURSE, { d: ledInput })).edubridgeCreateCourse
    expect(led.teacher_usernames).toEqual([teacher.account])
    const mine = (await assignmentsOf()).filter(a => a.course_id === led.id)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ teacher_username: teacher.account, status: 'ACTIVE' })
  })

  it(caseName('edu.teacher.side.sync-01', 'преподавателя убрали из курса — допуск снят, допуск к другому курсу остался'), async () => {
    const updated = (await gql<any>(chairman, UPDATE_COURSE, { d: { ...ledInput, id: led.id, teacher_usernames: [] } })).edubridgeUpdateCourse
    expect(updated.teacher_usernames).toEqual([])
    const mine = await assignmentsOf()
    expect(mine.filter(a => a.course_id === led.id && a.status === 'ACTIVE')).toEqual([])
    expect(mine.filter(a => a.course_id === course.id && a.status === 'ACTIVE')).toHaveLength(1)
  })
})
