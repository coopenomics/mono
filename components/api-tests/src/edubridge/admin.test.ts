/**
 * Стол администратора «Образования» и выдача доступа снаружи
 * (test-registry/edubridge.admin.yaml, edubridge.access.yaml,
 * edubridge.desktop-gating.yaml, edubridge.onboarding.yaml,
 * edubridge.contract.yaml).
 *
 * Доступ выдаётся очным пропуском: чужих площадок на стенде нет, их адреса
 * вшиты в коннекторы, поэтому всё, что зависит от ответа Skillspace и
 * GetCourse, снаружи не проверяется. Очередь выдачи работает раз в полминуты —
 * набор ждёт её исхода.
 *
 * Связка с Благоростом на время своего случая включается и возвращается
 * выключенной: с ней столы Благороста остаются только преподавателям и совету.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, amount, caseName, expectCode, freshMember, gql, gqlError, login, registerCandidate, tokenOf, waitFor } from '../core'
import { blank, templates } from '../documents/docs-reports.helpers'
import {
  CANCEL_ENROLLMENT,
  EXTENSION,
  NO_RIGHTS,
  UPDATE_LEARNER,
  addLearner,
  approveContract,
  createSection,
  deskGrants,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  onboardTeacher,
  pendingContractApproval,
  publishCourse,
  signOffer,
  subscribe,
} from './edubridge.helpers'

const TASK_FIELDS = 'id enrollment_id kind carrier status attempts last_error done_at'
const MEMBER_CARD = `query($u:String!){ edubridgeMemberCard(username:$u){
  username display_name learners{ id display_name recipient_type recipient_value } enrollments{ id status access_state } tasks{ ${TASK_FIELDS} }
} }`
const MEMBERS = 'query($s:String){ edubridgeMembers(search:$s){ username display_name learners_count active_enrollments attention_count } }'
const QUEUE = `query($f:EduQueueFilterInput){ edubridgeQueue(filter:$f){ ${TASK_FIELDS} } }`
const RETRY_TASK = `mutation($d:EduRetryTaskInput!){ edubridgeRetryTask(data:$d){ ${TASK_FIELDS} } }`
const CONNECTOR_FIELDS = 'carrier enabled configured health last_check_at last_check_message credential_fields{ key label secret is_set }'
const CONNECTORS = `query{ edubridgeConnectors{ ${CONNECTOR_FIELDS} } }`
const SET_CREDENTIALS = `mutation($d:EduSetConnectorCredentialsInput!){ edubridgeSetConnectorCredentials(data:$d){ ${CONNECTOR_FIELDS} } }`
const CHECK_CONNECTOR = `mutation($c:EduAccessCarrier!){ edubridgeCheckConnector(carrier:$c){ ${CONNECTOR_FIELDS} } }`
const ATTENTION = 'query{ edubridgeAttention{ learners teachers } }'
const TEACHER_APPROVALS = 'query($u:String!){ edubridgeTeacherApprovals(username:$u){ approval_hash username action title created_at } }'
const EXTENSIONS = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name enabled config } }'
const UPDATE_EXTENSION = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'
const REGISTRATION = 'query($t:AccountType!,$c:String!){ getRegistrationConfig(account_type:$t, coopname:$c){ programs{ key title applicable_account_types intake_forms{ id } } } }'
const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'

const R = { program: 3000, parentOffer: 3002, teacherOffer: 3004, contract: 3006 }

describe('Образование: стол администратора, выдача доступа, подключение', () => {
  let chairman = ''
  let council = ''
  let section = ''
  let course: any
  let learner: Who
  let token = ''
  let self: any
  let enrollment: any

  const card = async (t: string) => (await gql<any>(t, MEMBER_CARD, { u: learner.account })).edubridgeMemberCard
  const programKeys = async (): Promise<string[]> =>
    ((await gql<any>(null, REGISTRATION, { t: 'individual', c: COOP })).getRegistrationConfig.programs as any[]).map(p => String(p.key))
  /** Анкеты программ витрины вступления; с образцом — только программ с подходящим ключом. */
  const programForms = async (only?: RegExp): Promise<string[]> =>
    ((await gql<any>(null, REGISTRATION, { t: 'individual', c: COOP })).getRegistrationConfig.programs as any[])
      .filter(p => !only || only.test(String(p.key)))
      .flatMap(p => (p.intake_forms as any[]).map(f => String(f.id)))
  const capitalGrants = async (t: string | null): Promise<string[]> =>
    ((await gql<any>(t, DESKTOP)).getDesktop.workspaces as any[]).filter(w => w.extension_name === 'capital').flatMap(w => (w.grants ?? []) as string[])

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    council = await tokenOf(COUNCIL)
    section = await createSection(chairman)
    course = await publishCourse(chairman, section, 30)

    learner = freshMember({ prefix: 'eduv', firstName: 'Варвара', lastName: 'Очнопропускова', middleName: 'Игоревна' })
    token = await login(learner)
    await signOffer(learner, token, 'PARENT')
    self = await addLearner(token, 'Варвара сама', true)
    await fundShare(learner, token, amount(course.fee_month) * 2)
    enrollment = await subscribe(learner, token, self.id, course.id)
  }, 900_000)

  afterAll(async () => {
    await educationOff()
  })

  it(caseName('edu.access.happy.01', 'после оплаты задача выдачи выполняется: доступ выдан'), async () => {
    const granted = await waitFor(async () => {
      const e = await enrollmentOf(token, enrollment.id)
      return e?.access_state === 'GRANTED' ? e : null
    }, { timeoutMs: 180_000, intervalMs: 3_000, label: 'очередь выдала доступ по подписке' })
    expect(granted.status).toBe('ACTIVE')

    const tasks = (await card(chairman)).tasks as any[]
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ enrollment_id: enrollment.id, kind: 'GRANT', carrier: 'ONSITE', status: 'DONE', last_error: null })
    expect(tasks[0].done_at).toBeTruthy()
    // В очереди «требует внимания» выполненной задачи нет.
    const stuck = (await gql<any>(chairman, QUEUE, { f: { statuses: ['NEEDS_ATTENTION', 'FAILED'] } })).edubridgeQueue as any[]
    expect(stuck.map(t => t.id)).not.toContain(tasks[0].id)
  }, 300_000)

  it(caseName('edu.admin.happy.01', 'карточка пайщика: администратору контакт обучающегося скрыт, председателю виден'), async () => {
    const forOwner = await card(chairman)
    expect(forOwner.username).toBe(learner.account)
    expect(forOwner.learners).toHaveLength(1)
    expect(forOwner.learners[0].recipient_value).toBe(self.recipient_value)
    expect(forOwner.enrollments.map((e: any) => e.id)).toEqual([enrollment.id])

    const forAdmin = await card(council)
    expect(forAdmin.learners[0]).toMatchObject({ id: self.id, display_name: 'Варвара сама', recipient_value: null })
    expect(forAdmin.enrollments.map((e: any) => e.id)).toEqual([enrollment.id])
    // Самому пайщику и постороннему карточка реестра закрыта.
    expectCode(await gqlError(token, MEMBER_CARD, { u: learner.account }), NO_RIGHTS)
    expectCode(await gqlError(chairman, MEMBER_CARD, { u: ROLES.member().account }), 'EDUBRIDGE_MEMBER_NOT_FOUND')
  })

  it(caseName('edu.admin.side.11', 'реестр учеников называет пайщика по фамилии, имени и отчеству и ищет по ним'), async () => {
    const found = (await gql<any>(council, MEMBERS, { s: 'очнопропускова' })).edubridgeMembers as any[]
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ username: learner.account, display_name: 'Очнопропускова Варвара Игоревна', learners_count: 1, active_enrollments: 1 })
    expect(((await gql<any>(council, MEMBERS, { s: learner.account })).edubridgeMembers as any[]).map(m => m.username)).toEqual([learner.account])
    expect((await gql<any>(council, MEMBERS, { s: 'такогопайщиканет' })).edubridgeMembers).toEqual([])
    expect((await card(chairman)).display_name).toBe('Очнопропускова Варвара Игоревна')
  })

  it(caseName('edu.access.side.05', 'смена адреса доставки при действующей подписке: старый пропуск отзывается, новый выдаётся отдельной задачей'), async () => {
    await gql(token, UPDATE_LEARNER, { d: { id: self.id, display_name: 'Варвара сама', recipient_type: 'ONSITE', recipient_value: 'пропуск-новый-адрес' } })
    const tasks = await waitFor(async () => {
      const list = (await card(chairman)).tasks as any[]
      return list.length >= 3 && list.every(t => t.status === 'DONE') ? list : null
    }, { timeoutMs: 180_000, intervalMs: 3_000, label: 'очередь переоформила доступ после смены адреса' })
    expect(tasks.map(t => t.kind).sort()).toEqual(['GRANT', 'GRANT', 'REVOKE'])
    // Отзыв прежнего адреса состояние доступа не меняет.
    expect((await enrollmentOf(token, enrollment.id))?.access_state).toBe('GRANTED')
    // Правка одного имени доступ не переоформляет.
    await gql(token, UPDATE_LEARNER, { d: { id: self.id, display_name: 'Варвара', recipient_type: 'ONSITE', recipient_value: 'пропуск-новый-адрес' } })
    expect(((await card(chairman)).tasks as any[])).toHaveLength(3)
  }, 300_000)

  it(caseName('edu.admin.happy.03', 'повтор задачи из очереди: задача снова ждёт выполнения, счёт попыток сохранён'), async () => {
    const task = ((await card(chairman)).tasks as any[]).filter(t => t.kind === 'GRANT').pop()
    expectCode(await gqlError(token, RETRY_TASK, { d: { task_id: task.id } }), NO_RIGHTS)
    const retried = (await gql<any>(council, RETRY_TASK, { d: { task_id: task.id } })).edubridgeRetryTask
    expect(retried).toMatchObject({ id: task.id, status: 'PENDING', attempts: task.attempts, last_error: null })
    await waitFor(async () => (((await card(chairman)).tasks as any[]).find(t => t.id === task.id)?.status === 'DONE' ? true : null),
      { timeoutMs: 180_000, intervalMs: 3_000, label: 'повторённая задача выполнена очередью' })
  }, 300_000)

  it(caseName('edu.admin.happy.02', 'состояние площадок: ключи в ответе отсутствуют, видно только «задан» и здоровье'), async () => {
    const list = (await gql<any>(chairman, CONNECTORS)).edubridgeConnectors as any[]
    expect(list.map(c => c.carrier)).toEqual(expect.arrayContaining(['SKILLSPACE', 'GETCOURSE', 'ONSITE']))
    for (const c of list) {
      expect(typeof c.configured, c.carrier).toBe('boolean')
      expect(c.health, c.carrier).toBeTruthy()
      for (const f of c.credential_fields as any[]) expect(Object.keys(f).sort(), 'значения ключа среди полей нет').toEqual(['is_set', 'key', 'label', 'secret'])
    }
    // Очный пропуск проверяется без чужой площадки.
    const onsite = (await gql<any>(chairman, CHECK_CONNECTOR, { c: 'ONSITE' })).edubridgeCheckConnector
    expect(onsite).toMatchObject({ carrier: 'ONSITE', health: 'OK' })
    expect(onsite.last_check_at).toBeTruthy()
  })

  it(caseName('edu.admin.side.12', 'ключи площадки сохраняются и наружу не выдаются; пустое значение оставляет прежнее'), async () => {
    const getcourse = ((await gql<any>(chairman, CONNECTORS)).edubridgeConnectors as any[]).find(c => c.carrier === 'GETCOURSE')
    const keys = (getcourse.credential_fields as any[]).map(f => f.key as string)
    expect(keys.length).toBeGreaterThan(0)
    const values = keys.map(key => ({ key, value: `api-tests-${key}` }))
    const saved = (await gql<any>(chairman, SET_CREDENTIALS, { d: { carrier: 'GETCOURSE', values } })).edubridgeSetConnectorCredentials
    expect((saved.credential_fields as any[]).every(f => f.is_set)).toBe(true)
    expect(saved.configured).toBe(true)
    expect(JSON.stringify(saved), 'значение ключа в ответе не встречается').not.toContain('api-tests-')
    expect(JSON.stringify((await gql<any>(chairman, CONNECTORS)).edubridgeConnectors)).not.toContain('api-tests-')

    // Пустое значение прежнего ключа не стирает.
    const kept = (await gql<any>(chairman, SET_CREDENTIALS, { d: { carrier: 'GETCOURSE', values: keys.map(key => ({ key, value: '' })) } })).edubridgeSetConnectorCredentials
    expect((kept.credential_fields as any[]).every(f => f.is_set)).toBe(true)
    // Ключи задаёт председатель: совету операция закрыта.
    expectCode(await gqlError(council, SET_CREDENTIALS, { d: { carrier: 'GETCOURSE', values } }), NO_RIGHTS)
  })

  describe('преподаватель с договором на подписи у председателя', () => {
    let teacher: Who
    let teacherToken = ''

    beforeAll(async () => {
      teacher = freshMember({ prefix: 'eduw' })
      teacherToken = await login(teacher)
      await onboardTeacher(teacher, teacherToken, '900.0000 RUB', { approve: false })
    }, 300_000)

    it(caseName('edu.admin.side.15', 'карточка преподавателя показывает его договор на подписи у председателя'), async () => {
      const waiting = await waitFor(async () => {
        const list = (await gql<any>(chairman, TEACHER_APPROVALS, { u: teacher.account })).edubridgeTeacherApprovals as any[]
        return list.length ? list : null
      }, { timeoutMs: 60_000, intervalMs: 1_000, label: 'договор преподавателя в его карточке у председателя' })
      expect(waiting).toHaveLength(1)
      expect(waiting[0]).toMatchObject({ username: teacher.account })
      expect(waiting[0].title).toBeTruthy()
      expect(waiting[0].approval_hash).toMatch(/^[0-9a-fA-F]{64}$/)
      // У пайщика без документов на подписи список пуст.
      expect((await gql<any>(chairman, TEACHER_APPROVALS, { u: learner.account })).edubridgeTeacherApprovals).toEqual([])
      expectCode(await gqlError(teacherToken, TEACHER_APPROVALS, { u: teacher.account }), NO_RIGHTS)
    })

    it(caseName('edu.admin.side.16', 'сводка дел: администратор видит документы преподавателей на подписи, ученику и преподавателю — нули'), async () => {
      const forOwner = (await gql<any>(chairman, ATTENTION)).edubridgeAttention
      expect(forOwner.teachers).toBeGreaterThanOrEqual(1)
      expect(forOwner.learners).toBeGreaterThanOrEqual(0)
      expect((await gql<any>(token, ATTENTION)).edubridgeAttention).toEqual({ learners: 0, teachers: 0 })
      expect((await gql<any>(teacherToken, ATTENTION)).edubridgeAttention).toEqual({ learners: 0, teachers: 0 })

      // Председатель подписал договор — дел по этому преподавателю больше нет.
      await approveContract(await pendingContractApproval(teacher.account))
      await waitFor(async () => (((await gql<any>(chairman, TEACHER_APPROVALS, { u: teacher.account })).edubridgeTeacherApprovals as any[]).length === 0 ? true : null),
        { timeoutMs: 60_000, intervalMs: 1_000, label: 'подписанный договор ушёл из дел председателя' })
      expect((await gql<any>(chairman, ATTENTION)).edubridgeAttention.teachers).toBe(forOwner.teachers - 1)
    })
  })

  it(caseName('edu.gating.side.01', 'кандидат, ещё не принятый в кооператив, получает на столах программы только каталог'), async () => {
    const candidate = await registerCandidate({ prefix: 'educ' })
    expect(await deskGrants(candidate.token)).toEqual(['EduCatalog:read'])
    expect(await gqlError(candidate.token, 'query{ edubridgeMyLearners{ id } }')).not.toBeNull()
  })

  it(caseName('edu.onb.happy.01', 'витрина вступления предлагает программы «Обучение» и «Преподавание» физическому лицу'), async () => {
    const config = (await gql<any>(null, REGISTRATION, { t: 'individual', c: COOP })).getRegistrationConfig
    const education = (config.programs as any[]).filter(p => ['EDUCATION', 'EDUCATION_TEACHING'].includes(String(p.key)))
    expect(education.map(p => p.key).sort()).toEqual(['EDUCATION', 'EDUCATION_TEACHING'])
    for (const p of education) {
      expect(p.title, p.key).toBeTruthy()
      expect(p.applicable_account_types, p.key).toContain('individual')
    }
    // Оферты программ — утверждённые советом документы кооператива.
    const declared = (await templates(chairman)).filter(t => t.extension_name === EXTENSION)
    for (const id of [R.parentOffer, R.teacherOffer])
      expect(declared.find(t => t.registry_id === id), `оферта ${id}`).toMatchObject({ kind: 'Agreement', state: 'Approved' })
  })

  it(caseName('edu.teach.happy.10', 'расширение объявило свои документы в реестре шаблонов кооператива: положение, оферты, договор, бланки, протоколы'), async () => {
    const declared = (await templates(chairman)).filter(t => t.extension_name === EXTENSION)
    const of = (id: number) => declared.find(t => t.registry_id === id)
    expect(of(R.program)).toMatchObject({ kind: 'Provision', approval: 'Required', state: 'Approved' })
    expect(of(R.contract)).toMatchObject({ kind: 'Agreement', approval: 'Required', state: 'Approved' })
    const forms = declared.filter(t => t.kind === 'Form')
    expect(forms.length, 'бланки заявлений и актов').toBeGreaterThanOrEqual(4)
    expect(new Set(forms.map(t => t.bundle)).size, 'бланки утверждаются одной связкой').toBe(1)
    for (const f of forms) expect(f, String(f.registry_id)).toMatchObject({ approval: 'Required', state: 'Approved' })
    const service = declared.filter(t => t.kind === 'Service')
    expect(service.length, 'протоколы совета').toBeGreaterThanOrEqual(1)
    for (const s of service) expect(s.approval, String(s.registry_id)).toBe('None')
    // Шаблоны-двойники «для утверждения» не объявляются.
    for (const twin of [3001, 3003, 3005]) expect(of(twin), String(twin)).toBeUndefined()
    expect(new Set(declared.map(t => t.registry_id)).size).toBe(declared.length)
  })

  it(caseName('edu.doc.happy.05', 'положение о программе и договор преподавателя собираются утверждённым текстом без незаполненных мест'), async () => {
    for (const id of [R.program, R.contract, R.parentOffer, R.teacherOffer]) {
      const doc = await blank(chairman, id, 'Approved')
      expect(doc.html.length, String(id)).toBeGreaterThan(1000)
      expect(doc.html, String(id)).not.toMatch(/undefined|\[object Object\]|\{\{|\}\}|\{%|%\}/)
      expect(doc.title, String(id)).toBeTruthy()
    }
    // В бланке поля пайщика стоят прочерком.
    expect((await blank(chairman, R.contract, 'Approved')).html).toContain('______')
  })

  describe('сужение Благороста', () => {
    let extension: any
    const setIntegration = async (enabled: boolean) => {
      await gql(chairman, UPDATE_EXTENSION, { d: { name: EXTENSION, enabled: true, config: { ...(extension.config ?? {}), capital_integration: enabled } } })
      // Расширение перезапускается после ответа; настройка читается с задержкой до десяти секунд.
      await waitFor(async () => {
        const ext = ((await gql<any>(chairman, EXTENSIONS, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
        return ext?.enabled && ext.config?.capital_integration === enabled && (await gqlError(chairman, ATTENTION)) === null ? true : null
      }, { timeoutMs: 120_000, intervalMs: 2_000, label: `связка с Благоростом ${enabled ? 'включена' : 'выключена'}` })
    }

    beforeAll(async () => {
      extension = ((await gql<any>(chairman, EXTENSIONS, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
    })

    afterAll(async () => {
      await setIntegration(false)
    })

    it(caseName('edu.gating.happy.05', 'связка с Благоростом: его столы остаются совету, рядовому пайщику закрыты, программы при вступлении скрыты'), async () => {
      const member = await tokenOf(ROLES.member())
      const before = {
        programs: await programKeys(),
        member: await capitalGrants(member),
        council: await capitalGrants(council),
        forms: await programForms(/GENERATION|CAPITALIZATION/),
        education: await deskGrants(member),
        educationCouncil: await deskGrants(council),
      }
      expect(before.programs.some(k => /GENERATION|CAPITALIZATION/.test(k)), 'без связки программы Благороста предлагаются').toBe(true)
      expect(before.council.length).toBeGreaterThan(0)

      await setIntegration(true)
      await waitFor(async () => ((await programKeys()).some(k => /GENERATION|CAPITALIZATION/.test(k)) ? null : true),
        { timeoutMs: 60_000, intervalMs: 2_000, label: 'программы Благороста скрыты при вступлении' })
      expect(await programKeys()).toEqual(expect.arrayContaining(['EDUCATION', 'EDUCATION_TEACHING']))
      // Скрытая программа уходит из витрины вместе со своей анкетой.
      expect(before.forms.length, 'у программ Благороста есть своя анкета').toBeGreaterThan(0)
      const offered = await programForms()
      for (const form of before.forms) expect(offered, `анкета скрытой программы ${form}`).not.toContain(form)
      // Собственные столы автора правила правило не трогает.
      expect(await deskGrants(member), 'столы образования у пайщика прежние').toEqual(before.education)
      expect(await deskGrants(council)).toEqual(before.educationCouncil)
      expect(await capitalGrants(member), 'рядовому пайщику столы Благороста закрыты').toEqual([])
      expect(await capitalGrants(null)).toEqual([])
      expect((await capitalGrants(council)).sort(), 'совету столы Благороста оставлены').toEqual([...before.council].sort())

      await setIntegration(false)
      await waitFor(async () => ((await programKeys()).some(k => /GENERATION|CAPITALIZATION/.test(k)) ? true : null),
        { timeoutMs: 60_000, intervalMs: 2_000, label: 'программы Благороста снова предлагаются' })
      expect((await capitalGrants(member)).sort()).toEqual([...before.member].sort())
    }, 600_000)
  })

  it(caseName('edu.access.happy.03', 'отмена подписки отзывает доступ'), async () => {
    await gql(token, CANCEL_ENROLLMENT, { id: enrollment.id })
    const revoked = await waitFor(async () => {
      const e = await enrollmentOf(token, enrollment.id)
      return e?.access_state === 'REVOKED' ? e : null
    }, { timeoutMs: 180_000, intervalMs: 3_000, label: 'очередь отозвала доступ по отменённой подписке' })
    expect(revoked.status).toBe('CANCELLED')
    const tasks = (await card(chairman)).tasks as any[]
    expect(tasks.filter(t => t.kind === 'REVOKE' && t.status === 'DONE').length).toBeGreaterThanOrEqual(2)
  }, 300_000)
})

describe('Образование выключено: сужение Благороста молчит', () => {
  it(caseName('edu.gating.side.09', 'при выключенном образовании программы Благороста предлагаются при вступлении, его столы открыты как были'), async () => {
    const chairman = await tokenOf(CHAIRMAN)
    const ext = ((await gql<any>(chairman, EXTENSIONS, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
    expect(ext?.enabled, 'образование выключено после набора').toBe(false)
    const keys = await waitFor(async () => {
      const list = ((await gql<any>(null, REGISTRATION, { t: 'individual', c: COOP })).getRegistrationConfig.programs as any[]).map(p => String(p.key))
      return list.some(k => /GENERATION|CAPITALIZATION/.test(k)) ? list : null
    }, { timeoutMs: 60_000, intervalMs: 2_000, label: 'программы Благороста в витрине вступления' })
    expect(keys).not.toContain('EDUCATION')
    expect(keys).not.toContain('EDUCATION_TEACHING')
    const desks = ((await gql<any>(await tokenOf(COUNCIL), DESKTOP)).getDesktop.workspaces as any[])
    expect(desks.filter(w => w.extension_name === 'capital').flatMap(w => w.grants ?? []).length).toBeGreaterThan(0)
    expect(desks.filter(w => w.extension_name === EXTENSION)).toEqual([])
  })
})
