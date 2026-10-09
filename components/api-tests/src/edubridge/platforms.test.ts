/**
 * Выдача доступа на площадках Skillspace и GetCourse снаружи
 * (test-registry/edubridge.access.yaml, edubridge.admin.yaml).
 *
 * Площадки играет подставной узел стенда: набор задаёт его ответы и читает,
 * что платформа ему отправила. Адреса площадок берутся из настроек
 * расширения; на время набора они указывают на узел, очередь выдачи работает
 * раз в пять секунд, по окончании настройки возвращаются.
 *
 * Площадке уходит только адрес почты обучающегося — ни имени, ни телефона.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, STUB_URL, amount, caseName, expectCode, freshMember, gql, gqlError, login, stubRequests, stubReset, stubRoute, tokenOf, waitFor } from '../core'
import {
  CANCEL_ENROLLMENT,
  COURSE,
  EXTENSION,
  UPDATE_COURSE,
  CREATE_COURSE,
  SET_COURSE_STATUS,
  courseInput,
  createSection,
  educationOff,
  educationOn,
  enrollmentOf,
  fundShare,
  signOffer,
  subscribe,
} from './edubridge.helpers'

const EXTENSIONS = 'query($d:GetExtensionsInput){ getExtensions(data:$d){ name enabled config } }'
const UPDATE_EXTENSION = 'mutation($d:ExtensionInput!){ updateExtension(data:$d){ name enabled } }'
const TASK_FIELDS = 'id enrollment_id kind carrier status attempts last_error last_result done_at'
const MEMBER_CARD = `query($u:String!){ edubridgeMemberCard(username:$u){ tasks{ ${TASK_FIELDS} } } }`
const LEARNER_ACCOUNTS = 'query($u:String!){ edubridgeMemberCard(username:$u){ learner_accounts{ learner_id carriers active_enrollments removed_at } } }'
const MARK_REMOVED = 'mutation($d:EduMarkLearnerRemovedInput!){ edubridgeMarkLearnerRemoved(data:$d){ learner_id carriers active_enrollments removed_at } }'
const RETRY_TASK = `mutation($d:EduRetryTaskInput!){ edubridgeRetryTask(data:$d){ ${TASK_FIELDS} } }`
const CONNECTOR_FIELDS = 'carrier configured health last_check_at last_check_message'
const CONNECTORS = `query{ edubridgeConnectors{ ${CONNECTOR_FIELDS} } }`
const SET_CREDENTIALS = `mutation($d:EduSetConnectorCredentialsInput!){ edubridgeSetConnectorCredentials(data:$d){ ${CONNECTOR_FIELDS} } }`
const CHECK_CONNECTOR = `mutation($c:EduAccessCarrier!){ edubridgeCheckConnector(carrier:$c){ ${CONNECTOR_FIELDS} } }`
const PLATFORM_COURSES = 'query($c:EduAccessCarrier!){ edubridgePlatformCourses(carrier:$c){ id name groups{ id name } } }'
const ADD_LEARNER = 'mutation($d:EduLearnerInput!){ edubridgeAddLearner(data:$d){ id recipient_value } }'
const COURSE_SEEN = 'query($id:ID!){ edubridgeCourse(id:$id){ id external_ref external_title_seen } }'

const SS = '/skillspace'
const GC_ACCOUNT = 'school'
const GC = `/getcourse/${GC_ACCOUNT}`
const SS_KEY = 'stub-skillspace-key'
const GC_KEY = 'stub-getcourse-key'
/** Курс и группа школы Skillspace в реестрах подставного узла. */
const SS_COURSE = crypto.randomUUID()
const SS_GROUP = crypto.randomUUID()
const SS_OTHER_COURSE = crypto.randomUUID()
const SS_OTHER_GROUP = crypto.randomUUID()
const GC_GROUP = 'group-edubridge'

/** Тело запроса к площадке строкой — как оно ушло формой. */
function formOf(body: unknown): URLSearchParams {
  if (typeof body === 'string')
    return new URLSearchParams(body)
  return new URLSearchParams(Object.entries((body ?? {}) as Record<string, string>).map(([k, v]) => [k, String(v)]))
}

describe('Образование: выдача доступа на площадках Skillspace и GetCourse', () => {
  let chairman = ''
  let section = ''
  let member: Who
  let token = ''
  let originalConfig: Record<string, unknown> = {}
  let learnerNo = 0

  /** Реестры школы и успешные ответы площадок — исходное состояние узла. */
  async function healthyPlatforms(): Promise<void> {
    await stubRoute('GET', `${SS}/school/course/list`, { body: [{ id: SS_COURSE, name: 'Курс школы' }, { id: SS_OTHER_COURSE, name: 'Другой курс школы' }] })
    await stubRoute('GET', `${SS}/school/group/list`, { body: [{ id: SS_GROUP, courseId: SS_COURSE, name: 'Группа курса' }, { id: SS_OTHER_GROUP, courseId: SS_OTHER_COURSE, name: 'Чужая группа' }] })
    await stubRoute('POST', `${SS}/course/student-invite`, { body: { passwordSetupLink: 'https://school.example/setup' } })
    await stubRoute('POST', `${SS}/course/*`, { body: {} })
    await stubRoute('GET', `${GC}/pl/api/account/groups`, { body: { success: true, info: { items: [{ id: 1, name: GC_GROUP }] } } })
    await stubRoute('POST', `${GC}/pl/api/users`, { body: { success: true, result: { success: true } } })
  }

  async function platformCourse(over: Record<string, unknown>): Promise<any> {
    const created = (await gql<any>(chairman, CREATE_COURSE, { d: courseInput(section, { direction: 'ONLINE_PLATFORM', starts_at: undefined, ...over }) })).edubridgeCreateCourse
    return (await gql<any>(chairman, SET_COURSE_STATUS, { d: { id: created.id, status: 'PUBLISHED' } })).edubridgeSetCourseStatus
  }
  const skillspaceCourse = (ref = SS_COURSE) => platformCourse({ carrier: 'SKILLSPACE', external_ref: ref })
  const getcourseCourse = (ref = GC_GROUP) => platformCourse({ carrier: 'GETCOURSE', external_ref: ref })

  /** Новый обучающийся со своей почтой и его подписка на курс. */
  async function enroll(courseId: string): Promise<{ email: string, enrollment: any }> {
    learnerNo += 1
    const email = `learner-${learnerNo}-${crypto.randomBytes(3).toString('hex')}@school.example`
    const learner = (await gql<any>(token, ADD_LEARNER, { d: { display_name: `Иванов Пётр Сергеевич ${learnerNo}`, recipient_type: 'EMAIL', recipient_value: email } })).edubridgeAddLearner
    return { email, enrollment: await subscribe(member, token, learner.id, courseId) }
  }

  const tasksOf = async (enrollmentId: string): Promise<any[]> =>
    ((await gql<any>(chairman, MEMBER_CARD, { u: member.account })).edubridgeMemberCard.tasks as any[]).filter(t => t.enrollment_id === enrollmentId)

  /** Задача подписки дошла до одного из состояний. */
  async function taskIn(enrollmentId: string, kind: 'GRANT' | 'REVOKE', statuses: string[], minAttempts = 1): Promise<any> {
    return waitFor(async () => {
      const task = (await tasksOf(enrollmentId)).find(t => t.kind === kind)
      return task && statuses.includes(task.status) && task.attempts >= minAttempts ? task : null
    }, { timeoutMs: 120_000, intervalMs: 2_000, label: `задача ${kind} по подписке — ${statuses.join(' или ')}` })
  }

  const connector = async (carrier: string) =>
    ((await gql<any>(chairman, CONNECTORS)).edubridgeConnectors as any[]).find(c => c.carrier === carrier)

  beforeAll(async () => {
    await educationOn()
    chairman = await tokenOf(CHAIRMAN)
    section = await createSection(chairman)
    await stubReset()
    await healthyPlatforms()

    const ext = ((await gql<any>(chairman, EXTENSIONS, { d: {} })).getExtensions as any[]).find(e => e.name === EXTENSION)
    originalConfig = ext.config ?? {}
    await gql(chairman, UPDATE_EXTENSION, {
      d: {
        name: EXTENSION,
        enabled: true,
        config: { ...originalConfig, skillspace_api_base: `${STUB_URL}${SS}`, getcourse_api_base: `${STUB_URL}/getcourse/{account}`, outbox_interval_sec: 5 },
      },
    })
    await gql(chairman, SET_CREDENTIALS, { d: { carrier: 'SKILLSPACE', values: [{ key: 'api_key', value: SS_KEY }] } })
    await gql(chairman, SET_CREDENTIALS, { d: { carrier: 'GETCOURSE', values: [{ key: 'account', value: GC_ACCOUNT }, { key: 'api_key', value: GC_KEY }] } })
    // Расширение перезапускается после ответа, настройки читаются с задержкой до десяти секунд:
    // ждём, пока проверка площадки дойдёт до подставного узла.
    await waitFor(async () => {
      if (await gqlError(chairman, CHECK_CONNECTOR, { c: 'SKILLSPACE' }))
        return null
      return (await stubRequests(`${SS}/school/course/list`)).length > 0 ? true : null
    }, { timeoutMs: 120_000, intervalMs: 3_000, label: 'расширение ходит на подставной узел вместо площадки' })

    member = freshMember({ prefix: 'edupl' })
    token = await login(member)
    await signOffer(member, token, 'PARENT')
    const course = await skillspaceCourse()
    await fundShare(member, token, amount(course.fee_month) * 16)
  }, 900_000)

  afterAll(async () => {
    await educationOff(originalConfig)
    await stubReset()
  })

  it(caseName('edu.admin.side.13', 'проверка площадки с верным ключом идёт одним чтением, курсы для неё не нужны'), async () => {
    const before = (await stubRequests(`${SS}/school/course/list`)).length
    const state = (await gql<any>(chairman, CHECK_CONNECTOR, { c: 'SKILLSPACE' })).edubridgeCheckConnector
    expect(state).toMatchObject({ carrier: 'SKILLSPACE', configured: true, health: 'OK' })
    expect(state.last_check_at).toBeTruthy()
    expect(state.last_check_message).toBeTruthy()
    const calls = await stubRequests(`${SS}/school/course/list`)
    expect(calls.length - before, 'одно чтение реестра школы').toBe(1)
    expect(calls.at(-1)!.query.token).toBe(SS_KEY)
    expect((await gql<any>(chairman, CHECK_CONNECTOR, { c: 'GETCOURSE' })).edubridgeCheckConnector.health).toBe('OK')
    expect((await stubRequests(`${GC}/pl/api/account/groups`)).at(-1)!.query.key).toBe(GC_KEY)

    // Конструктор курса получает курсы школы с их группами.
    const school = (await gql<any>(chairman, PLATFORM_COURSES, { c: 'SKILLSPACE' })).edubridgePlatformCourses as any[]
    expect(school.find(c => c.id === SS_COURSE)).toMatchObject({ name: 'Курс школы', groups: [{ id: SS_GROUP, name: 'Группа курса' }] })
  })

  it(caseName('edu.admin.side.14', 'проверка площадки с неверным ключом помечает её сбоящей и называет причину'), async () => {
    await stubRoute('GET', `${SS}/school/course/list`, { status: 404, body: { SCHOOL_PUBLIC_TOKEN_NOT_FOUND: 'api.error.SCHOOL_PUBLIC_TOKEN_NOT_FOUND' } })
    try {
      const state = (await gql<any>(chairman, CHECK_CONNECTOR, { c: 'SKILLSPACE' })).edubridgeCheckConnector
      expect(state.health).toBe('FAILING')
      expect(state.last_check_message, 'причина названа словами').toBeTruthy()
      expect(state.last_check_message).not.toContain('SCHOOL_PUBLIC_TOKEN_NOT_FOUND')
    }
    finally {
      await healthyPlatforms()
    }
    expect((await gql<any>(chairman, CHECK_CONNECTOR, { c: 'SKILLSPACE' })).edubridgeCheckConnector.health).toBe('OK')
  })

  describe('Skillspace', () => {
    let course: any

    it(caseName('edu.access.happy.04', 'запросы площадкам несут только почту обучающегося: Skillspace — приглашение в курс и группу, GetCourse — добавление в группу'), async () => {
      course = await skillspaceCourse(`${SS_COURSE}:${SS_GROUP}`)
      const ss = await enroll(course.id)
      await taskIn(ss.enrollment.id, 'GRANT', ['DONE'])
      expect((await enrollmentOf(token, ss.enrollment.id))?.access_state).toBe('GRANTED')
      const invite = (await stubRequests(`${SS}/course/student-invite`)).map(r => formOf(r.body)).find(f => f.get('email') === ss.email)
      expect(invite, 'приглашение на почту обучающегося').toBeTruthy()
      expect(invite!.get('token')).toBe(SS_KEY)
      expect(invite!.get(`courses[${SS_COURSE}]`)).toBe(SS_GROUP)
      expect([...invite!.keys()].sort(), 'ни имени, ни телефона').toEqual([`courses[${SS_COURSE}]`, 'email', 'token'].sort())

      const gcCourse = await getcourseCourse()
      const gc = await enroll(gcCourse.id)
      await taskIn(gc.enrollment.id, 'GRANT', ['DONE'])
      const add = (await stubRequests(`${GC}/pl/api/users`)).map(r => formOf(r.body)).find(f => Buffer.from(f.get('params') ?? '', 'base64').toString('utf8').includes(gc.email))
      expect(add, 'добавление в группу по почте обучающегося').toBeTruthy()
      expect(add!.get('action')).toBe('add')
      expect(add!.get('key')).toBe(GC_KEY)
      const params = JSON.parse(Buffer.from(add!.get('params')!, 'base64').toString('utf8'))
      expect(params.user).toEqual({ email: gc.email, group_name: [GC_GROUP] })
      expect(JSON.stringify(params), 'имя обучающегося площадке не уходит').not.toContain('Иванов')

      // Отзыв доступа GetCourse — добавление в группу-сигнал.
      await gql(token, CANCEL_ENROLLMENT, { id: gc.enrollment.id })
      await taskIn(gc.enrollment.id, 'REVOKE', ['DONE'])
      const signal = (await stubRequests(`${GC}/pl/api/users`)).map(r => JSON.parse(Buffer.from(formOf(r.body).get('params') ?? '', 'base64').toString('utf8') || '{}'))
        .find(p => p.user?.email === gc.email && String(p.user?.group_name?.[0]).endsWith(':revoked'))
      expect(signal?.user.group_name).toEqual([`${GC_GROUP}:revoked`])
    }, 480_000)

    it(caseName('edu.access.happy.05', 'сверка курса и группы по реестрам школы: название курса запомнено'), async () => {
      const seen = (await gql<any>(chairman, COURSE_SEEN, { id: course.id })).edubridgeCourse
      expect(seen.external_title_seen, 'название курса на площадке — для обнаружения переименования').toBe('Курс школы')
      expect((await stubRequests(`${SS}/school/group/list`)).length).toBeGreaterThan(0)

      // Группа другого курса и курс, которого в школе нет, — доступ не выдаётся.
      const invitesBefore = (await stubRequests(`${SS}/course/student-invite`)).length
      const foreignGroup = await enroll((await skillspaceCourse(`${SS_COURSE}:${SS_OTHER_GROUP}`)).id)
      const unknown = await enroll((await skillspaceCourse(crypto.randomUUID())).id)
      for (const e of [foreignGroup, unknown]) {
        const task = await taskIn(e.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])
        expect(task.last_error, 'причина названа').toBeTruthy()
        expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('NEEDS_ATTENTION')
      }
      expect((await stubRequests(`${SS}/course/student-invite`)).length, 'приглашения на несверенный курс не было').toBe(invitesBefore)
    }, 480_000)

    it(caseName('edu.access.side.07', 'сверка курса с площадкой запоминается: вторая выдача по тому же курсу реестр школы не читает'), async () => {
      const lists = (await stubRequests(`${SS}/school/course/list`)).length
      const again = await enroll(course.id)
      await taskIn(again.enrollment.id, 'GRANT', ['DONE'])
      expect((await stubRequests(`${SS}/school/course/list`)).length).toBe(lists)
      // Смена привязки курса сверку сбрасывает.
      const input = courseInput(section, { direction: 'ONLINE_PLATFORM', carrier: 'SKILLSPACE', external_ref: SS_OTHER_COURSE, title: course.title })
      await gql(chairman, UPDATE_COURSE, { d: { ...input, id: course.id } })
      expect((await gql<any>(chairman, COURSE_SEEN, { id: course.id })).edubridgeCourse).toMatchObject({ external_ref: SS_OTHER_COURSE, external_title_seen: null })
      await gql(chairman, UPDATE_COURSE, { d: { ...input, id: course.id, external_ref: `${SS_COURSE}:${SS_GROUP}` } })
      expect((await gql<any>(chairman, COURSE, { id: course.id })).edubridgeCourse.id).toBe(course.id)
    }, 300_000)

    it(caseName('edu.access.side.10', 'доступ получателя к курсу площадки оплачен другой подпиской — отзыв площадке не уходит, пока действует вторая'), async () => {
      // Два курса кооператива привязаны к одному курсу школы; обучающийся подписан на оба.
      const [first, second] = [await skillspaceCourse(), await skillspaceCourse()]
      learnerNo += 1
      const email = `learner-${learnerNo}-${crypto.randomBytes(3).toString('hex')}@school.example`
      const learner = (await gql<any>(token, ADD_LEARNER, { d: { display_name: `Иванов Пётр Сергеевич ${learnerNo}`, recipient_type: 'EMAIL', recipient_value: email } })).edubridgeAddLearner
      const a = await subscribe(member, token, learner.id, first.id)
      const b = await subscribe(member, token, learner.id, second.id)
      await taskIn(a.id, 'GRANT', ['DONE'])
      await taskIn(b.id, 'GRANT', ['DONE'])
      const removals = async (): Promise<number> =>
        (await stubRequests(`${SS}/course/${SS_COURSE}/student-remove`)).filter(r => formOf(r.body).get('email') === email).length

      // Первая подписка закрыта: задача отзыва выполнена, но с курса школы ученика не снимают.
      await gql(token, CANCEL_ENROLLMENT, { id: a.id })
      await taskIn(a.id, 'REVOKE', ['DONE'])
      expect(await removals(), 'отзыв площадке не ушёл: доступ оплачен второй подпиской').toBe(0)
      expect((await enrollmentOf(token, a.id))?.access_state).toBe('REVOKED')

      // Закрыта и вторая — теперь ученик снимается с курса школы.
      await gql(token, CANCEL_ENROLLMENT, { id: b.id })
      await taskIn(b.id, 'REVOKE', ['DONE'])
      expect(await removals()).toBe(1)
    }, 480_000)

    it(caseName('edu.access.side.11', 'аккаунт обучающегося без подписок: администратор отмечает, что удалил его с площадки; новая выдача отметку снимает'), async () => {
      const course = await skillspaceCourse()
      learnerNo += 1
      const email = `learner-${learnerNo}-${crypto.randomBytes(3).toString('hex')}@school.example`
      const learner = (await gql<any>(token, ADD_LEARNER, { d: { display_name: `Иванов Пётр Сергеевич ${learnerNo}`, recipient_type: 'EMAIL', recipient_value: email } })).edubridgeAddLearner
      const accountOf = async (): Promise<any> =>
        ((await gql<any>(chairman, LEARNER_ACCOUNTS, { u: member.account })).edubridgeMemberCard.learner_accounts as any[]).find(a => a.learner_id === learner.id)

      const first = await subscribe(member, token, learner.id, course.id)
      await taskIn(first.id, 'GRANT', ['DONE'])
      expect(await accountOf()).toMatchObject({ carriers: ['SKILLSPACE'], active_enrollments: 1, removed_at: null })
      // Пока подписка действует, аккаунт нужен — отметка не ставится.
      expectCode(await gqlError(chairman, MARK_REMOVED, { d: { learner_id: learner.id } }), 'EDUBRIDGE_LEARNER_HAS_SUBSCRIPTIONS')
      // Обучающийся и ученик отметку поставить не могут.
      expect(await gqlError(token, MARK_REMOVED, { d: { learner_id: learner.id } })).not.toBeNull()

      await gql(token, CANCEL_ENROLLMENT, { id: first.id })
      await taskIn(first.id, 'REVOKE', ['DONE'])
      expect(await accountOf()).toMatchObject({ carriers: ['SKILLSPACE'], active_enrollments: 0, removed_at: null })
      const marked = (await gql<any>(chairman, MARK_REMOVED, { d: { learner_id: learner.id } })).edubridgeMarkLearnerRemoved
      expect(marked.removed_at).toBeTruthy()

      // Новая подписка: доступ выдаётся как обычно, отметка снята.
      const again = await subscribe(member, token, learner.id, (await skillspaceCourse()).id)
      await taskIn(again.id, 'GRANT', ['DONE'])
      expect(await accountOf()).toMatchObject({ active_enrollments: 1, removed_at: null })
    }, 480_000)

    it(caseName('edu.access.side.04', 'курс удалён на площадке — задача требует внимания без выдачи; площадка недоступна при сверке — задача ждёт повтора'), async () => {
      const gone = await skillspaceCourse(SS_OTHER_COURSE)
      await stubRoute('GET', `${SS}/school/course/list`, { body: [{ id: SS_COURSE, name: 'Курс школы' }] })
      try {
        const deleted = await enroll(gone.id)
        expect((await taskIn(deleted.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])).last_error).toBeTruthy()

        await stubRoute('GET', `${SS}/school/course/list`, { status: 503, body: 'площадка на обслуживании' })
        const waiting = await enroll((await skillspaceCourse(SS_COURSE)).id)
        const task = await taskIn(waiting.enrollment.id, 'GRANT', ['PENDING'])
        expect(task.last_result).toBe('retryable')
        expect((await enrollmentOf(token, waiting.enrollment.id))?.access_state, 'доступ ждёт, внимания не требует').toBe('PENDING')
      }
      finally {
        await healthyPlatforms()
      }
    }, 300_000)

    it(caseName('edu.access.side.02', 'площадка недоступна при выдаче — задача остаётся в очереди и выполняется повтором'), async () => {
      await stubRoute('POST', `${SS}/course/student-invite`, { status: 503, body: 'временно недоступно' })
      const e = await enroll((await skillspaceCourse()).id)
      const failed = await taskIn(e.enrollment.id, 'GRANT', ['PENDING'])
      expect(failed.attempts).toBe(1)
      expect(failed.last_error).toContain('503')
      expect((await connector('SKILLSPACE')).health).toBe('FAILING')

      await healthyPlatforms()
      // Следующая попытка сама — через минуту; администратор повторяет сразу.
      await gql(chairman, RETRY_TASK, { d: { task_id: failed.id } })
      const done = await taskIn(e.enrollment.id, 'GRANT', ['DONE'], 2)
      expect(done.attempts).toBe(2)
      expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('GRANTED')
      expect((await connector('SKILLSPACE')).health).toBe('OK')
    }, 300_000)

    it(caseName('edu.access.side.09', 'адрес сотрудника школы: задача требует внимания с объяснением словами, а не кодом площадки'), async () => {
      await stubRoute('POST', `${SS}/course/student-invite`, { status: 400, body: { INVITE_ONLY_EMPLOYEE: 'api.error.INVITE_ONLY_EMPLOYEE' } })
      try {
        const e = await enroll((await skillspaceCourse()).id)
        const task = await taskIn(e.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])
        expect(task.last_result).toBe('INVITE_ONLY_EMPLOYEE')
        expect(task.last_error).toBeTruthy()
        expect(task.last_error).not.toContain('INVITE_ONLY_EMPLOYEE')
        expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('NEEDS_ATTENTION')
      }
      finally {
        await healthyPlatforms()
      }
    }, 300_000)

    it(caseName('edu.access.side.08', 'повторное приглашение и повторный отзыв проходят; неверный курс и неверный ключ разбираются по коду из тела ответа'), async () => {
      const e = await enroll((await skillspaceCourse()).id)
      const first = await taskIn(e.enrollment.id, 'GRANT', ['DONE'])
      // Повторное приглашение площадка принимает пустым ответом.
      await stubRoute('POST', `${SS}/course/student-invite`, { body: {} })
      await gql(chairman, RETRY_TASK, { d: { task_id: first.id } })
      expect((await taskIn(e.enrollment.id, 'GRANT', ['DONE'], 2)).attempts).toBe(2)

      await gql(token, CANCEL_ENROLLMENT, { id: e.enrollment.id })
      const revoke = await taskIn(e.enrollment.id, 'REVOKE', ['DONE'])
      const removed = (await stubRequests(`${SS}/course/${SS_COURSE}/student-remove`)).map(r => formOf(r.body)).find(f => f.get('email') === e.email)
      expect(removed, 'отзыв по почте обучающегося').toBeTruthy()
      await gql(chairman, RETRY_TASK, { d: { task_id: revoke.id } })
      expect((await taskIn(e.enrollment.id, 'REVOKE', ['DONE'], 2)).attempts).toBe(2)
      expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('REVOKED')

      try {
        await stubRoute('POST', `${SS}/course/student-invite`, { status: 404, body: { COURSE_NOT_FOUND: 'api.error.COURSE_NOT_FOUND' } })
        const wrongCourse = await enroll((await skillspaceCourse()).id)
        expect((await taskIn(wrongCourse.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])).last_result).toBe('COURSE_NOT_FOUND')

        await stubRoute('POST', `${SS}/course/student-invite`, { status: 404, body: { SCHOOL_PUBLIC_TOKEN_NOT_FOUND: 'api.error.SCHOOL_PUBLIC_TOKEN_NOT_FOUND' } })
        const wrongKey = await enroll((await skillspaceCourse()).id)
        expect((await taskIn(wrongKey.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])).last_result).toBe('UNAUTHORIZED')
      }
      finally {
        await healthyPlatforms()
      }
    }, 480_000)

    it(caseName('edu.access.side.01', 'курс уже удалён в школе — отзывать нечего, отзыв считается выполненным'), async () => {
      const e = await enroll((await skillspaceCourse()).id)
      await taskIn(e.enrollment.id, 'GRANT', ['DONE'])
      await stubRoute('POST', `${SS}/course/*`, { status: 404, body: { COURSE_NOT_FOUND: 'api.error.COURSE_NOT_FOUND' } })
      try {
        await gql(token, CANCEL_ENROLLMENT, { id: e.enrollment.id })
        const revoke = await taskIn(e.enrollment.id, 'REVOKE', ['DONE'])
        expect(revoke.last_result).toBe('exists')
        expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('REVOKED')
      }
      finally {
        await healthyPlatforms()
      }
    }, 300_000)
  })

  it(caseName('edu.access.side.03', 'лимит лицензии площадки: задача сразу требует внимания, площадка отмечена состоянием «лимит лицензии»'), async () => {
    await stubRoute('POST', `${GC}/pl/api/users`, { body: { success: false, error_message: 'Limit reached' } })
    try {
      const e = await enroll((await getcourseCourse()).id)
      const task = await taskIn(e.enrollment.id, 'GRANT', ['NEEDS_ATTENTION'])
      expect(task.attempts).toBe(1)
      expect(task.last_result).toBe('LICENSE_LIMIT')
      expect((await enrollmentOf(token, e.enrollment.id))?.access_state).toBe('NEEDS_ATTENTION')
      const state = await connector('GETCOURSE')
      expect(state.health).toBe('LICENSE_LIMIT')
      expect(state.last_check_message).toBeTruthy()
    }
    finally {
      await healthyPlatforms()
    }
  }, 300_000)
})
