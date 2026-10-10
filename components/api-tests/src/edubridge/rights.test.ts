/**
 * Права программы «Образование» снаружи (test-registry/edubridge.desktop-gating.yaml,
 * edubridge.catalog.yaml, edubridge.admin.yaml).
 *
 * Гость видит только каталог. Пайщик без оферты ученика страниц ученика не
 * получает. Должность личный стол не открывает: председатель без оферты и
 * договора преподавателя прав стола преподавателя не имеет. Стол администратора
 * читают член совета, администратор и председатель; курсы, допуски
 * преподавателей и очередь ведут председатель и администратор; ставки, целевой
 * взнос, расходы программы, отклонение взноса и площадки — только председатель.
 * Администратора назначает председатель на общей странице управления доступом.
 *
 * Интерфейс мог скрыть кнопку — сервер обязан отказать сам, поэтому каждое
 * право проверяется и по правам стола, и прямым вызовом операции.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, caseName, expectAuthDenied, expectCode, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  CATALOG_COURSE,
  CATALOG_PAGE,
  COURSE,
  CREATE_COURSE,
  MY_ASSIGNMENTS,
  MY_ENROLLMENTS,
  MY_LEARNERS,
  NO_RIGHTS,
  PLANNED_RATE,
  SAVE_SECTION,
  SET_ASSIGNMENT_RATE,
  SET_COURSE_STATUS,
  SET_TEACHER_RATE,
  courseInput,
  createSection,
  deskGrants,
  educationOff,
  educationOn,
  offersState,
  publishCourse,
} from './edubridge.helpers'

const COURSES = 'query{ edubridgeCourses{ totalCount } }'
const CONNECTORS = 'query{ edubridgeConnectors{ carrier } }'
const ROLES_LIST = 'query{ getAssignableRoles{ key extension_name assignments{ username } } }'
const ASSIGN = 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key assignments{ username assigned_by } } }'
const REVOKE = 'mutation($d:RoleAssignmentInput!){ revokeRole(data:$d){ key } }'
const EDU_ADMIN = 'edu-admin'

/** Права страниц ученика и преподавателя — их открывает подключение, а не должность. */
const LEARNER_DESK = ['EduLearner:read:own', 'EduLearner:manage:own', 'EduEnrollment:read:own', 'EduEnrollment:create:own']
const TEACHER_DESK = ['EduAssignment:read:own', 'EduContribution:read:own', 'EduContribution:create:own', 'EduTeacherWallet:read:own', 'EduTeacherWallet:manage:own']
/** Чтение стола администратора: член совета, администратор и председатель. */
const STAFF_READ = ['EduCourse:read', 'EduRegistry:read', 'EduQueue:read', 'EduAssignment:read:all', 'EduContribution:read:all', 'EduEconomy:read']
/** Ведение программы: администратор и председатель. */
const ADMIN_WRITE = ['EduCourse:manage', 'EduQueue:manage', 'EduAssignment:manage']
/** Только у председателя. */
const OWNER_ONLY = ['EduEconomy:manage', 'EduContribution:decide', 'EduContacts:read', 'EduConnector:manage', 'EduSettings:manage']

describe('Образование: права гостя, пайщика, совета и председателя', () => {
  let chairman = ''
  let council = ''
  let member: Who
  let memberToken = ''
  let section = ''
  let published: any
  let draft: any

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    council = await tokenOf(COUNCIL)
    section = await createSection(chairman)
    published = await publishCourse(chairman, section, 30)
    draft = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section) })).edubridgeCreateCourse
    member = freshMember({ prefix: 'edur' })
    memberToken = await login(member)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.gating.happy.01', 'гостю на столах программы выдан только каталог'), async () => {
    expect(await deskGrants(null)).toEqual(['EduCatalog:read'])
    expectAuthDenied(await gqlError(null, MY_LEARNERS))
    expectAuthDenied(await gqlError(null, MY_ENROLLMENTS))
    expectAuthDenied(await gqlError(null, MY_ASSIGNMENTS))
    expectAuthDenied(await gqlError(null, COURSES))
    expectAuthDenied(await gqlError(null, CREATE_COURSE, { d: courseInput(section) }))
  })

  it(caseName('edu.catalog.happy.01', 'гость читает каталог и карточку опубликованного курса; служебных полей в карточке нет'), async () => {
    const page = (await gql<any>(null, CATALOG_PAGE, { f: { section_id: section } })).edubridgeCatalog
    expect((page.items as any[]).map(c => c.id), 'в каталоге только опубликованный курс раздела').toEqual([published.id])
    expect(page.totalCount).toBe(1)

    const card = (await gql<any>(null, CATALOG_COURSE, { id: published.id })).edubridgeCatalogCourse
    expect(card).toEqual({ id: published.id, title: published.title, fee_month: published.fee_month })
    // Направление, привязку к площадке и состояние карточка каталога не отдаёт вовсе.
    for (const field of ['status', 'direction', 'external_ref'])
      expect(await gqlError(null, `query($id:ID!){ edubridgeCatalogCourse(id:$id){ id ${field} } }`, { id: published.id }), field).not.toBeNull()
  })

  it(caseName('edu.catalog.side.01', 'черновик курса гостю и пайщику по прямой ссылке не открывается'), async () => {
    expectCode(await gqlError(null, CATALOG_COURSE, { id: draft.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')
    expectCode(await gqlError(memberToken, CATALOG_COURSE, { id: draft.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')
    // Снятый с публикации курс с витрины уходит.
    const hidden = await publishCourse(chairman, section, 30)
    expect((await gql<any>(null, CATALOG_COURSE, { id: hidden.id })).edubridgeCatalogCourse.id).toBe(hidden.id)
    await gql(chairman, SET_COURSE_STATUS, { d: { id: hidden.id, status: 'ARCHIVED' } })
    expectCode(await gqlError(null, CATALOG_COURSE, { id: hidden.id }), 'EDUBRIDGE_COURSE_NOT_FOUND')
  })

  it(caseName('edu.gating.happy.03', 'пайщик без оферт видит каталог и подключение; страниц ученика и преподавателя у него нет'), async () => {
    const state = await offersState(memberToken)
    expect(state.parent.source).toBe('GATE_REQUIRED')
    expect(state.teacher.source).toBe('GATE_REQUIRED')
    expect(await deskGrants(memberToken)).toEqual(['EduCatalog:read', 'Onboarding:learner', 'Onboarding:teacher'])

    expectCode(await gqlError(memberToken, MY_LEARNERS), NO_RIGHTS)
    expectCode(await gqlError(memberToken, MY_ENROLLMENTS), NO_RIGHTS)
    expectCode(await gqlError(memberToken, MY_ASSIGNMENTS), NO_RIGHTS)
    // Каталог пайщику открыт, как гостю.
    expect((await gql<any>(memberToken, CATALOG_COURSE, { id: published.id })).edubridgeCatalogCourse.id).toBe(published.id)
  })

  it(caseName('edu.catalog.break.01', 'пайщик не правит курсы, разделы и ставку преподавателя'), async () => {
    expectCode(await gqlError(memberToken, CREATE_COURSE, { d: courseInput(section) }), NO_RIGHTS)
    expectCode(await gqlError(memberToken, SET_COURSE_STATUS, { d: { id: draft.id, status: 'PUBLISHED' } }), NO_RIGHTS)
    expectCode(await gqlError(memberToken, SAVE_SECTION, { d: { title: 'Раздел пайщика' } }), NO_RIGHTS)
    expectCode(await gqlError(memberToken, SET_TEACHER_RATE, { d: { username: member.account, hourly_rate: PLANNED_RATE } }), NO_RIGHTS)
    expectCode(await gqlError(memberToken, COURSES), NO_RIGHTS)
    expectCode(await gqlError(memberToken, COURSE, { id: draft.id }), NO_RIGHTS)
    expect((await gql<any>(chairman, COURSE, { id: draft.id })).edubridgeCourse.status, 'черновик остался черновиком').toBe('DRAFT')
  })

  it(caseName('edu.gating.break.03', 'председатель без договора преподавателя прав стола преподавателя не получает'), async () => {
    const state = await offersState(chairman)
    expect(state.teacher.source, 'председатель стенда оферту преподавателя не подписывал').toBe('GATE_REQUIRED')
    const grants = await deskGrants(chairman)
    expect(grants).toContain('Onboarding:teacher')
    for (const right of TEACHER_DESK) expect(grants, right).not.toContain(right)
    // Управление назначениями всех преподавателей у председателя есть — это стол администратора.
    expect(grants).toEqual(expect.arrayContaining(['EduAssignment:read:all', 'EduAssignment:manage']))
  })

  it(caseName('edu.gating.side.07', 'председатель без оферты ученика страниц ученика не получает'), async () => {
    expect((await offersState(chairman)).parent.source, 'председатель стенда оферту ученика не подписывал').toBe('GATE_REQUIRED')
    const grants = await deskGrants(chairman)
    expect(grants).toEqual(expect.arrayContaining(['EduCatalog:read', 'Onboarding:learner']))
    for (const right of LEARNER_DESK) expect(grants, right).not.toContain(right)
    expectCode(await gqlError(chairman, MY_LEARNERS), NO_RIGHTS)
    expectCode(await gqlError(chairman, MY_ENROLLMENTS), NO_RIGHTS)
  })

  it(caseName('edu.gating.happy.06', 'стол администратора: председатель ведёт всё, член совета только читает'), async () => {
    const owner = await deskGrants(chairman)
    expect(owner).toEqual(expect.arrayContaining([...STAFF_READ, ...ADMIN_WRITE, ...OWNER_ONLY]))

    const board = await deskGrants(council)
    expect(board).toEqual(expect.arrayContaining(STAFF_READ))
    for (const right of [...ADMIN_WRITE, ...OWNER_ONLY]) expect(board, right).not.toContain(right)
    // Охват «все» в «свои» для стола не разворачивается.
    expect(board).not.toContain('EduAssignment:read:own')

    expect(await gqlError(council, COURSES)).toBeNull()
    expect(await gqlError(council, COURSE, { id: draft.id })).toBeNull()
    expectCode(await gqlError(council, CREATE_COURSE, { d: courseInput(section) }), NO_RIGHTS)
    expectCode(await gqlError(council, SAVE_SECTION, { d: { title: 'Раздел члена совета' } }), NO_RIGHTS)
    expectCode(await gqlError(council, SET_COURSE_STATUS, { d: { id: draft.id, status: 'PUBLISHED' } }), NO_RIGHTS)
    expectCode(await gqlError(council, SET_TEACHER_RATE, { d: { username: member.account, hourly_rate: PLANNED_RATE } }), NO_RIGHTS)
    expectCode(await gqlError(council, CONNECTORS), NO_RIGHTS)
    expect((await gql<any>(chairman, COURSE, { id: draft.id })).edubridgeCourse.status, 'черновик остался черновиком').toBe('DRAFT')
  })

  it(caseName('edu.admin.break.01', 'администратор образования назначается на общей странице доступа: ведёт курсы, деньги и площадки ему закрыты'), async () => {
    const declared = ((await gql<any>(chairman, ROLES_LIST)).getAssignableRoles as any[]).find(r => r.key === EDU_ADMIN)
    expect(declared, 'роль объявлена приложением образования').toMatchObject({ extension_name: 'edubridge' })
    // Назначать роли может только председатель.
    expect(await gqlError(council, ASSIGN, { d: { username: member.account, role: EDU_ADMIN } }), 'член совета роль не назначает').not.toBeNull()

    const assigned = (await gql<any>(chairman, ASSIGN, { d: { username: member.account, role: EDU_ADMIN } })).assignRole
    expect((assigned.assignments as any[]).find(a => a.username === member.account)).toMatchObject({ assigned_by: CHAIRMAN.account })
    try {
      const grants = await deskGrants(memberToken)
      expect(grants).toEqual(expect.arrayContaining([...STAFF_READ, ...ADMIN_WRITE]))
      for (const right of OWNER_ONLY) expect(grants, right).not.toContain(right)

      expect(await createSection(memberToken), 'администратор добавил раздел').toBeTruthy()
      expect(await gqlError(memberToken, COURSES)).toBeNull()
      expectCode(await gqlError(memberToken, CONNECTORS), NO_RIGHTS)
      expectCode(await gqlError(memberToken, SET_TEACHER_RATE, { d: { username: member.account, hourly_rate: PLANNED_RATE } }), NO_RIGHTS)
      expectCode(await gqlError(memberToken, SET_ASSIGNMENT_RATE, { d: { assignment_id: draft.id, hourly_rate: PLANNED_RATE } }), NO_RIGHTS)
      expect(await gqlError(memberToken, ASSIGN, { d: { username: CHAIRMAN.account, role: EDU_ADMIN } }), 'администратор роли не назначает').not.toBeNull()
    }
    finally {
      await gql(chairman, REVOKE, { d: { username: member.account, role: EDU_ADMIN } })
    }

    // Пайщик со снятой ролью снова рядовой.
    expectCode(await gqlError(memberToken, COURSES), NO_RIGHTS)
    expect(await deskGrants(memberToken)).toEqual(['EduCatalog:read', 'Onboarding:learner', 'Onboarding:teacher'])
  })
})
