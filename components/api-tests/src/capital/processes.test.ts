/**
 * Благорост: процессы проекта — шаблоны и их исполнение
 * (test-registry/capital.processes.yaml).
 *
 * Шаблон процесса — граф шагов проекта. Совет рисует его черновиком,
 * включает, и по включённому шаблону запускается экземпляр: стартовые шаги
 * становятся задачами проекта, следующий шаг открывается, когда закрыты все
 * шаги, которые в него ведут, а экземпляр завершается с последним шагом.
 *
 * Мир теста: личный проект председателя и шаблон-ромб «подготовка → две
 * параллельные ветви → сборка».
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COUNCIL, ROLES, caseName, expectAuthDenied, expectCode, gql, gqlError, tokenOf } from '../core'
import { createLocalProject, issuesAs, tag } from './cap-access.helpers'

const TEMPLATE_FIELDS = 'id coopname project_hash title description status created_by steps{ id title description estimate is_start position{ x y } } edges{ id source target }'
const INSTANCE_FIELDS = 'id coopname template_id project_hash status started_by cycle completed_at step_states{ step_id status issue_hash completed_at }'

const CREATE = `mutation($d:CreateProcessTemplateInput!){ capitalCreateProcessTemplate(data:$d){ ${TEMPLATE_FIELDS} } }`
const UPDATE = `mutation($d:UpdateProcessTemplateInput!){ capitalUpdateProcessTemplate(data:$d){ ${TEMPLATE_FIELDS} } }`
const DELETE = 'mutation($id:String!){ capitalDeleteProcessTemplate(id:$id) }'
const TEMPLATES = `query($p:String){ capitalGetProcessTemplates(project_hash:$p){ ${TEMPLATE_FIELDS} } }`
const TEMPLATE = `query($id:String!){ capitalGetProcessTemplate(id:$id){ ${TEMPLATE_FIELDS} } }`
const START = `mutation($d:StartProcessInput!){ capitalStartProcess(data:$d){ ${INSTANCE_FIELDS} } }`
const COMPLETE = `mutation($d:CompleteProcessStepInput!){ capitalCompleteProcessStep(data:$d){ ${INSTANCE_FIELDS} } }`
const INSTANCES = `query($p:String!){ capitalGetProcessInstances(project_hash:$p){ ${INSTANCE_FIELDS} } }`
const INSTANCE = `query($id:String!){ capitalGetProcessInstance(id:$id){ ${INSTANCE_FIELDS} } }`

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const STEPS = [
  { id: 'prepare', title: 'Подготовка', description: 'Собрать исходные данные', estimate: 2, is_start: true, position: { x: 0, y: 0 } },
  { id: 'left', title: 'Левая ветвь', position: { x: -100, y: 100 } },
  { id: 'right', title: 'Правая ветвь', position: { x: 100, y: 100 } },
  { id: 'assemble', title: 'Сборка', position: { x: 0, y: 200 } },
]
const EDGES = [
  { id: 'e1', source: 'prepare', target: 'left' },
  { id: 'e2', source: 'prepare', target: 'right' },
  { id: 'e3', source: 'left', target: 'assemble' },
  { id: 'e4', source: 'right', target: 'assemble' },
]

let chairmanToken = ''
let memberToken = ''
let T = ''
let project: any
let templateId = ''
let instanceId = ''

function stateOf(instance: any, stepId: string): any {
  return instance.step_states.find((s: any) => s.step_id === stepId)
}

async function projectIssues(): Promise<any[]> {
  const r = await issuesAs(CHAIRMAN, { project_hash: project.project_hash }, { page: 1, limit: 100 })
  expect(r.errors).toEqual([])
  return r.data.capitalIssues.items
}

async function newTemplate(title: string): Promise<any> {
  const d = await gql<any>(chairmanToken, CREATE, { d: { project_hash: project.project_hash, title } })
  return d.capitalCreateProcessTemplate
}

beforeAll(async () => {
  chairmanToken = await tokenOf(CHAIRMAN)
  memberToken = await tokenOf(ROLES.member())
  T = tag('proc')
  project = await createLocalProject(CHAIRMAN, `Процессы ${T}`)
}, 300_000)

describe('Благорост — процессы: шаблон', () => {
  it(caseName('cap.proc.happy.01', 'совет заводит шаблон процесса проекта — черновик без шагов, виден в списке проекта и по номеру'), async () => {
    const created = (await gql<any>(chairmanToken, CREATE, {
      d: { project_hash: project.project_hash, title: `Выпуск ${T}`, description: 'Порядок выпуска' },
    })).capitalCreateProcessTemplate
    templateId = created.id
    expect(created).toMatchObject({
      project_hash: project.project_hash,
      title: `Выпуск ${T}`,
      description: 'Порядок выпуска',
      status: 'DRAFT',
      created_by: CHAIRMAN.account,
      steps: [],
      edges: [],
    })

    const listed = (await gql<any>(chairmanToken, TEMPLATES, { p: project.project_hash })).capitalGetProcessTemplates
    expect(listed.map((t: any) => t.id)).toEqual([templateId])
    const all = (await gql<any>(chairmanToken, TEMPLATES, {})).capitalGetProcessTemplates
    expect(all.some((t: any) => t.id === templateId), 'шаблон есть и в общем списке кооператива').toBe(true)
    const byId = (await gql<any>(chairmanToken, TEMPLATE, { id: templateId })).capitalGetProcessTemplate
    expect(byId).toMatchObject({ id: templateId, title: `Выпуск ${T}`, status: 'DRAFT' })
  })

  it(caseName('cap.proc.happy.02', 'шаги, связи и название шаблона правятся и сохраняются как отправлены'), async () => {
    const updated = (await gql<any>(chairmanToken, UPDATE, {
      d: { id: templateId, title: `Выпуск ${T} — правка`, steps: STEPS, edges: EDGES },
    })).capitalUpdateProcessTemplate
    expect(updated.title).toBe(`Выпуск ${T} — правка`)
    expect(updated.status, 'правка шагов не включает шаблон').toBe('DRAFT')
    expect(updated.steps.map((s: any) => s.id)).toEqual(['prepare', 'left', 'right', 'assemble'])
    expect(updated.steps[0]).toMatchObject({ title: 'Подготовка', estimate: 2, is_start: true, position: { x: 0, y: 0 } })
    expect(updated.edges).toEqual(EDGES)

    const byId = (await gql<any>(chairmanToken, TEMPLATE, { id: templateId })).capitalGetProcessTemplate
    expect(byId.steps).toEqual(updated.steps)
    expect(byId.edges).toEqual(EDGES)
  })

  it(caseName('cap.proc.side.01', 'шаблон заводит, правит и удаляет только совет — пайщику отказ, шаблон не меняется'), async () => {
    expectCode(await gqlError(memberToken, CREATE, { d: { project_hash: project.project_hash, title: 'Чужой' } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, UPDATE, { d: { id: templateId, title: 'Чужая правка' } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, DELETE, { id: templateId }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, TEMPLATES, { p: project.project_hash }))

    const byId = (await gql<any>(chairmanToken, TEMPLATE, { id: templateId })).capitalGetProcessTemplate
    expect(byId.title).toBe(`Выпуск ${T} — правка`)
  })

  it(caseName('cap.proc.side.02', 'черновик запустить нельзя — отказ, экземпляр не создаётся'), async () => {
    expectCode(
      await gqlError(chairmanToken, START, { d: { template_id: templateId, project_hash: project.project_hash } }),
      'CAPITAL_PROCESS_TEMPLATE_NOT_ACTIVE',
    )
    const instances = (await gql<any>(chairmanToken, INSTANCES, { p: project.project_hash })).capitalGetProcessInstances
    expect(instances).toEqual([])
  })

  it(caseName('cap.proc.side.03', 'включённый шаблон без стартового шага запустить нельзя'), async () => {
    const empty = await newTemplate(`Без старта ${T}`)
    await gql(chairmanToken, UPDATE, {
      d: { id: empty.id, status: 'ACTIVE', steps: [{ id: 'only', title: 'Шаг без старта', position: { x: 0, y: 0 } }], edges: [] },
    })
    expectCode(
      await gqlError(chairmanToken, START, { d: { template_id: empty.id, project_hash: project.project_hash } }),
      'CAPITAL_PROCESS_TEMPLATE_NO_START_STEPS',
    )
  })

  it(caseName('cap.proc.side.04', 'удалённый шаблон пропадает из списка и по номеру не отдаётся'), async () => {
    const doomed = await newTemplate(`На удаление ${T}`)
    const d = await gql<any>(chairmanToken, DELETE, { id: doomed.id })
    expect(d.capitalDeleteProcessTemplate).toBe(true)

    const listed = (await gql<any>(chairmanToken, TEMPLATES, { p: project.project_hash })).capitalGetProcessTemplates
    expect(listed.some((t: any) => t.id === doomed.id)).toBe(false)
    expect((await gql<any>(chairmanToken, TEMPLATE, { id: doomed.id })).capitalGetProcessTemplate).toBeNull()
  })
})

describe('Благорост — процессы: исполнение', () => {
  it(caseName('cap.proc.happy.03', 'запуск включённого шаблона — экземпляр идёт, стартовый шаг активен, остальные ждут'), async () => {
    const active = (await gql<any>(chairmanToken, UPDATE, { d: { id: templateId, status: 'ACTIVE' } })).capitalUpdateProcessTemplate
    expect(active.status).toBe('ACTIVE')
    expect(active.steps.map((s: any) => s.id), 'включение не трогает шаги').toEqual(['prepare', 'left', 'right', 'assemble'])

    const started = (await gql<any>(chairmanToken, START, {
      d: { template_id: templateId, project_hash: project.project_hash },
    })).capitalStartProcess
    instanceId = started.id
    expect(started).toMatchObject({
      template_id: templateId,
      project_hash: project.project_hash,
      status: 'RUNNING',
      started_by: CHAIRMAN.account,
      cycle: 1,
      completed_at: null,
    })

    const instance = (await gql<any>(chairmanToken, INSTANCE, { id: instanceId })).capitalGetProcessInstance
    expect(stateOf(instance, 'prepare').status).toBe('ACTIVE')
    for (const waiting of ['left', 'right', 'assemble'])
      expect(stateOf(instance, waiting)).toMatchObject({ status: 'PENDING', issue_hash: null })

    const listed = (await gql<any>(chairmanToken, INSTANCES, { p: project.project_hash })).capitalGetProcessInstances
    expect(listed.map((i: any) => i.id)).toEqual([instanceId])
  })

  // До 02.10.2026 задача шагу не заводилась: номер задачи шага был длиннее колонки, ошибка
  // глоталась (C28-85, находка 64а). Теперь шаг получает обычную задачу проекта.
  it(caseName('cap.proc.happy.06', 'стартовый шаг становится задачей проекта с названием «[шаблон] шаг» и описанием шага'), async () => {
    const instance = (await gql<any>(chairmanToken, INSTANCE, { id: instanceId })).capitalGetProcessInstance
    const issueHash = stateOf(instance, 'prepare').issue_hash
    expect(issueHash, 'стартовый шаг получил задачу').toBeTruthy()
    const issue = (await projectIssues()).find(i => String(i.issue_hash).toLowerCase() === String(issueHash).toLowerCase())
    expect(issue, 'задача шага видна в проекте').toBeTruthy()
    expect(issue.title).toBe(`[Выпуск ${T} — правка] Подготовка`)
    expect(issue.description).toBe('Собрать исходные данные')
    expect(String(issueHash), 'хеш задачи шага — обычного вида, к нему привязывается коммит').toMatch(/^[0-9a-f]{64}$/i)
  })

  // До 02.10.2026 после первого закрытого шага экземпляр не читался: время закрытия лежало
  // строкой, поле ждало дату-время (C28-85, находка 64б).
  it(caseName('cap.proc.happy.04', 'закрытый шаг открывает следующие; шаг с двумя входами ждёт оба; последний шаг завершает экземпляр'), async () => {
    const afterPrepare = (await gql<any>(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'prepare' } })).capitalCompleteProcessStep
    expect(stateOf(afterPrepare, 'prepare').status).toBe('COMPLETED')
    expect(stateOf(afterPrepare, 'prepare').completed_at).toBeTruthy()
    expect(stateOf(afterPrepare, 'left').status).toBe('ACTIVE')
    expect(stateOf(afterPrepare, 'right').status).toBe('ACTIVE')
    expect(stateOf(afterPrepare, 'assemble').status).toBe('PENDING')
    expect(afterPrepare.status).toBe('RUNNING')

    const afterLeft = (await gql<any>(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'left' } })).capitalCompleteProcessStep
    expect(stateOf(afterLeft, 'assemble').status, 'второй вход ещё открыт').toBe('PENDING')
    expect(afterLeft.status).toBe('RUNNING')

    const afterRight = (await gql<any>(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'right' } })).capitalCompleteProcessStep
    expect(stateOf(afterRight, 'assemble').status).toBe('ACTIVE')
    expect(afterRight.status).toBe('RUNNING')

    const done = (await gql<any>(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'assemble' } })).capitalCompleteProcessStep
    expect(done.status).toBe('COMPLETED')
    expect(done.completed_at).toBeTruthy()

    const stored = (await gql<any>(chairmanToken, INSTANCE, { id: instanceId })).capitalGetProcessInstance
    expect(stored.status).toBe('COMPLETED')
    expect(stored.step_states.every((s: any) => s.status === 'COMPLETED')).toBe(true)
  })

  it(caseName('cap.proc.side.05', 'повторное закрытие шага ничего не меняет — задачи не удваиваются'), async () => {
    const before = (await projectIssues()).length
    const again = (await gql<any>(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'prepare' } })).capitalCompleteProcessStep
    expect(again.status).toBe('COMPLETED')
    expect((await projectIssues()).length).toBe(before)
  })

  it(caseName('cap.proc.side.06', 'шаг, которого нет в экземпляре, и экземпляр, которого нет, — отказ «не найдено»'), async () => {
    expectCode(
      await gqlError(chairmanToken, COMPLETE, { d: { instance_id: instanceId, step_id: 'ghost' } }),
      'CAPITAL_PROCESS_STEP_NOT_FOUND',
    )
    expectCode(
      await gqlError(chairmanToken, COMPLETE, { d: { instance_id: UNKNOWN_ID, step_id: 'prepare' } }),
      'CAPITAL_PROCESS_INSTANCE_NOT_FOUND',
    )
    expect((await gql<any>(chairmanToken, INSTANCE, { id: UNKNOWN_ID })).capitalGetProcessInstance).toBeNull()
  })

  it(caseName('cap.proc.side.07', 'процессы чужого личного проекта закрыты: посторонний не запускает, не закрывает шаги и не читает'), async () => {
    // До 03.10.2026 доступ к проекту не проверялся вовсе: любой пайщик запускал процесс в
    // чужом проекте, закрывал чужие шаги и читал шаблоны всех проектов (C28-85).
    const councilToken = await tokenOf(COUNCIL)
    const start = { d: { template_id: templateId, project_hash: project.project_hash } }
    for (const token of [memberToken, councilToken]) {
      expectCode(await gqlError(token, START, start), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      expectCode(await gqlError(token, COMPLETE, { d: { instance_id: instanceId, step_id: 'prepare' } }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      expectCode(await gqlError(token, TEMPLATES, { p: project.project_hash }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      expectCode(await gqlError(token, TEMPLATE, { id: templateId }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      expectCode(await gqlError(token, INSTANCES, { p: project.project_hash }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      expectCode(await gqlError(token, INSTANCE, { id: instanceId }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
      // В списке шаблонов кооператива чужого личного проекта нет.
      const all = (await gql<any>(token, TEMPLATES, {})).capitalGetProcessTemplates as any[]
      expect(all.some(t => t.project_hash === project.project_hash)).toBe(false)
    }
    // Член совета шаблон чужого личного проекта не заводит, не правит и не удаляет.
    expectCode(await gqlError(councilToken, CREATE, { d: { project_hash: project.project_hash, title: 'Чужой' } }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
    expectCode(await gqlError(councilToken, UPDATE, { d: { id: templateId, title: 'Чужая правка' } }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')
    expectCode(await gqlError(councilToken, DELETE, { id: templateId }), 'CAPITAL_PROCESS_PROJECT_FORBIDDEN')

    // Шаблон одного проекта в другом проекте не запускается.
    const other = await createLocalProject(CHAIRMAN, `Процессы ${T} — соседний`)
    expectCode(await gqlError(chairmanToken, START, { d: { template_id: templateId, project_hash: other.project_hash } }), 'CAPITAL_PROCESS_TEMPLATE_FOREIGN_PROJECT')

    // Владельцу всё по-прежнему видно, чужие запросы ничего не изменили.
    const mine = (await gql<any>(chairmanToken, INSTANCES, { p: project.project_hash })).capitalGetProcessInstances as any[]
    expect(mine.map(i => i.id)).toContain(instanceId)
    expect((await gql<any>(chairmanToken, TEMPLATE, { id: templateId })).capitalGetProcessTemplate.title).not.toBe('Чужая правка')
  })

  it(caseName('cap.proc.side.08', 'шаблона нет — отказ «не найдено»; номер не в виде UUID отклоняется на входе'), async () => {
    expectCode(await gqlError(chairmanToken, START, { d: { template_id: UNKNOWN_ID, project_hash: project.project_hash } }), 'CAPITAL_PROCESS_TEMPLATE_NOT_FOUND')
    expectCode(await gqlError(chairmanToken, UPDATE, { d: { id: UNKNOWN_ID, title: 'Нет такого' } }), 'CAPITAL_PROCESS_TEMPLATE_NOT_FOUND')
    expectCode(await gqlError(chairmanToken, DELETE, { id: UNKNOWN_ID }), 'CAPITAL_PROCESS_TEMPLATE_NOT_FOUND')

    expectCode(await gqlError(chairmanToken, START, { d: { template_id: 'не-номер', project_hash: project.project_hash } }), '422')
    expectCode(await gqlError(chairmanToken, UPDATE, { d: { id: 'не-номер', title: 'Нет такого' } }), '422')
    expectCode(await gqlError(chairmanToken, COMPLETE, { d: { instance_id: 'не-номер', step_id: 'prepare' } }), '422')
  })
})
