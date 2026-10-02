/**
 * Благорост: журнал событий проекта (test-registry/capital.project-log.yaml).
 *
 * Журнал проекта собирается из журнала мутаций узла: каждое успешное действие
 * над проектом, его компонентами и задачами становится событием с автором и
 * временем. Отказанные действия в журнал не попадают. Журнал задачи — события,
 * в записи которых есть хеш задачи.
 *
 * Мир теста: проект в цепи с компонентом и задачей, заведённые председателем.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, ROLES, caseName, expectAuthDenied, gql, gqlError, tokenOf, waitFor } from '../core'
import { createChainProject, createIssue, tag } from './cap-access.helpers'

const LOG = '_id coopname project_hash entity_type entity_id event_type initiator actor_name title message reference_id created_at'
const PROJECT_LOGS = `query($d:GetCapitalLogsInput!){ getCapitalProjectLogs(data:$d){ totalCount totalPages currentPage items{ ${LOG} } } }`
const ISSUE_LOGS = `query($d:GetCapitalIssueLogsInput!,$o:PaginationInput){ getCapitalIssueLogs(data:$d, options:$o){ totalCount items{ ${LOG} } } }`
const UPDATE_ISSUE = 'mutation($d:UpdateIssueInput!){ capitalUpdateIssue(data:$d){ issue_hash status } }'
const SET_MASTER = 'mutation($d:SetMasterInput!){ capitalSetMaster(data:$d){ __typename } }'

let chairman = ''
let T = ''
let project = ''
let component = ''
let issue: any

async function projectLogs(filter: Record<string, unknown>, pagination: Record<string, unknown> = { page: 1, limit: 100 }) {
  const d = await gql<any>(chairman, PROJECT_LOGS, { d: { filter: { project_hash: project, ...filter }, pagination } })
  return d.getCapitalProjectLogs as { totalCount: number, totalPages: number, currentPage: number, items: any[] }
}

beforeAll(async () => {
  chairman = await tokenOf(CHAIRMAN)
  T = tag('log')
  project = await createChainProject(`Журнал ${T}`)
  component = await createChainProject(`Журнал ${T} — компонент`, { parent_hash: project })
  issue = await createIssue(CHAIRMAN, { title: `Задача журнала ${T}`, project_hash: project, creators: [CHAIRMAN.account] })
  await gql(chairman, UPDATE_ISSUE, { d: { issue_hash: issue.issue_hash, status: 'IN_PROGRESS' } })
  // Журнал мутаций пишется после ответа мутации — ждём, пока последняя запись появится.
  await waitFor(async () => (await projectLogs({})).items.some(l => l.event_type === 'ISSUE_CREATED') ? true : null,
    { timeoutMs: 60_000, intervalMs: 1_000, label: 'события проекта в журнале' })
}, 600_000)

describe('Благорост — журнал событий проекта', () => {
  it(caseName('cap.log.happy.01', 'журнал проекта отдаёт события проекта, компонента и задачи — с автором, от новых к старым'), async () => {
    const log = await projectLogs({})
    const types = log.items.map(l => l.event_type)
    expect(types).toEqual(expect.arrayContaining(['PROJECT_CREATED', 'ISSUE_CREATED']))
    expect(log.items.every(l => l.initiator === CHAIRMAN.account && l.coopname === COOP)).toBe(true)
    expect(log.items.every(l => l.title && l.actor_name)).toBe(true)
    expect(log.items.some(l => l.project_hash === component), 'события компонента входят в журнал проекта').toBe(true)

    const times = log.items.map(l => new Date(l.created_at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(log.totalCount).toBe(log.items.length)
  })

  it(caseName('cap.log.side.01', 'события компонентов и задач отключаются отбором'), async () => {
    const own = await projectLogs({ show_components_logs: false })
    expect(own.items.every(l => l.project_hash === project)).toBe(true)
    expect(own.items.length).toBeLessThan((await projectLogs({})).items.length)

    const noIssues = await projectLogs({ show_issue_logs: false })
    expect(noIssues.items.some(l => l.entity_type === 'ISSUE')).toBe(false)
    expect(noIssues.items.some(l => l.event_type === 'PROJECT_CREATED')).toBe(true)
  })

  it(caseName('cap.log.side.02', 'журнал листается страницами; отбор по автору без его действий — пусто'), async () => {
    const all = await projectLogs({})
    const first = await projectLogs({}, { page: 1, limit: 1 })
    expect(first.items).toHaveLength(1)
    expect(first.totalCount).toBe(all.totalCount)
    expect(first.totalPages).toBe(all.totalCount)
    expect(first.items[0]._id).toBe(all.items[0]._id)

    const stranger = await projectLogs({ initiator: ROLES.member().account })
    expect(stranger.items).toEqual([])
    expect(stranger.totalCount).toBe(0)
  })

  it(caseName('cap.log.happy.02', 'журнал задачи — события только этой задачи'), async () => {
    const d = await gql<any>(chairman, ISSUE_LOGS, { d: { issue_hash: issue.issue_hash }, o: { page: 1, limit: 50 } })
    const items = d.getCapitalIssueLogs.items as any[]
    // Правка задачи в её журнале есть; создание — на решении владельца (cap.log.side.05).
    expect(items.map(l => l.event_type)).toContain('ISSUE_UPDATED')
    expect(items.every(l => l.entity_type === 'ISSUE')).toBe(true)
    expect(items.every(l => String(l.entity_id).toLowerCase() === String(issue.issue_hash).toLowerCase() || String(l.reference_id).toLowerCase() === String(issue.issue_hash).toLowerCase())).toBe(true)
  })

  it(caseName('cap.log.side.03', 'отказанное действие в журнал не попадает'), async () => {
    const before = (await projectLogs({})).totalCount
    // Пайщик без роли ведущего назначить не может — мутация отклонена.
    const refused = await gqlError(await tokenOf(ROLES.member()), SET_MASTER, { d: { coopname: COOP, project_hash: project, master: ROLES.member().account } })
    expect(refused, 'назначение ведущего пайщиком отклонено').not.toBeNull()
    expect((await projectLogs({})).totalCount).toBe(before)
    expect((await projectLogs({})).items.some(l => l.event_type === 'PROJECT_MASTER_ASSIGNED')).toBe(false)
  })

  it(caseName('cap.log.side.04', 'журнал читает только пайщик — гостю отказ входа'), async () => {
    expectAuthDenied(await gqlError(null, PROJECT_LOGS, { d: { filter: { project_hash: project } } }))
    expectAuthDenied(await gqlError(null, ISSUE_LOGS, { d: { issue_hash: issue.issue_hash } }))
  })
})
