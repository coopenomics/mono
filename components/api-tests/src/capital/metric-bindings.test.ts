/**
 * Благорост: привязка задачи к целям компонента
 * (test-registry/capital.metrics-measures.yaml, случаи cap.mm.bind.*).
 *
 * Задаче назначают, сколько она даст каждой цели компонента. Когда задача
 * выполнена, привязки становятся вкладами в цели; возврат задачи в работу
 * снимает ровно то, что было начислено. У выполненной задачи привязки
 * заперты, а привязать можно только действующую цель того же компонента.
 *
 * Мир теста: личный проект свежего пайщика с двумя целями и задачами; второй
 * личный проект — источник «чужой» цели.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, ROLES, caseName, expectCode, freshMember, gql, gqlError, tokenOf } from '../core'
import { createIssue, createLocalProject, tag } from './cap-access.helpers'

const BINDING = '_id issue_hash metric_hash delta'
const SET = `mutation($d:SetIssueMetricBindingsInput!){ capitalSetIssueMetricBindings(data:$d){ ${BINDING} } }`
const GET = `query($d:GetIssueMetricBindingsInput!){ capitalIssueMetricBindings(data:$d){ ${BINDING} } }`
const CREATE_METRIC = 'mutation($d:CreateComponentMetricInput!){ capitalCreateComponentMetric(data:$d){ metric_hash project_hash fact } }'
const ARCHIVE_METRIC = 'mutation($d:ArchiveComponentMetricInput!){ capitalArchiveComponentMetric(data:$d){ metric_hash status } }'
const COMPONENT_METRICS = 'query($d:GetComponentMetricsInput!){ capitalComponentMetrics(data:$d){ metric_hash fact status } }'
const UPDATE_ISSUE = 'mutation($d:UpdateIssueInput!){ capitalUpdateIssue(data:$d){ issue_hash status } }'

let owner: Who
let token = ''
let T = ''
let project = ''
let foreignProject = ''
let calls: any
let letters: any
let foreignMetric: any
let issue: any

async function metric(projectHash: string, title: string): Promise<any> {
  const d = await gql<any>(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: projectHash, target_value: 100, title, unit: 'шт' } })
  return d.capitalCreateComponentMetric
}

async function factOf(metricHash: string): Promise<number> {
  const d = await gql<any>(token, COMPONENT_METRICS, { d: { project_hash: project } })
  return Number(d.capitalComponentMetrics.find((m: any) => m.metric_hash === metricHash)?.fact)
}

async function bindingsOf(issueHash: string): Promise<any[]> {
  return (await gql<any>(token, GET, { d: { issue_hash: issueHash } })).capitalIssueMetricBindings
}

async function setStatus(issueHash: string, status: string): Promise<void> {
  await gql(token, UPDATE_ISSUE, { d: { issue_hash: issueHash, status } })
}

beforeAll(async () => {
  owner = freshMember({ prefix: 'capb' })
  token = await tokenOf(owner)
  T = tag('bind')
  project = (await createLocalProject(owner, `Привязки ${T}`)).project_hash
  foreignProject = (await createLocalProject(owner, `Привязки ${T} — другой`)).project_hash
  calls = await metric(project, `Звонки ${T}`)
  letters = await metric(project, `Письма ${T}`)
  foreignMetric = await metric(foreignProject, `Чужая ${T}`)
  issue = await createIssue(owner, { title: `Обзвон ${T}`, project_hash: project, creators: [owner.account] })
}, 300_000)

describe('Благорост — привязка задачи к целям компонента', () => {
  it(caseName('cap.mm.bind.happy.01', 'задаче назначают вклад в две цели — привязки сохраняются и читаются'), async () => {
    expect(await bindingsOf(issue.issue_hash), 'до назначения привязок нет').toEqual([])

    const saved = (await gql<any>(token, SET, {
      d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: calls.metric_hash, delta: 5 }, { metric_hash: letters.metric_hash, delta: 2.5 }] },
    })).capitalSetIssueMetricBindings
    expect(saved).toHaveLength(2)

    const stored = await bindingsOf(issue.issue_hash)
    const byMetric = Object.fromEntries(stored.map(b => [b.metric_hash, b.delta]))
    expect(byMetric).toEqual({ [calls.metric_hash]: 5, [letters.metric_hash]: 2.5 })
    expect(stored.every(b => b.issue_hash === issue.issue_hash)).toBe(true)
  })

  it(caseName('cap.mm.bind.happy.02', 'повторное назначение заменяет набор привязок целиком'), async () => {
    const saved = (await gql<any>(token, SET, {
      d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: calls.metric_hash, delta: 7 }] },
    })).capitalSetIssueMetricBindings
    expect(saved).toHaveLength(1)

    const stored = await bindingsOf(issue.issue_hash)
    expect(stored.map(b => [b.metric_hash, b.delta])).toEqual([[calls.metric_hash, 7]])
  })

  it(caseName('cap.mm.bind.side.01', 'цель другого компонента, выключенная цель и цель, которой нет, — отказ, набор привязок прежний'), async () => {
    expectCode(
      await gqlError(token, SET, { d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: foreignMetric.metric_hash, delta: 1 }] } }),
      'CAPITAL_METRIC_NOT_IN_COMPONENT',
    )
    expectCode(
      await gqlError(token, SET, { d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: 'e'.repeat(64), delta: 1 }] } }),
      'CAPITAL_METRIC_NOT_FOUND',
    )
    const retired = await metric(project, `Выключенная ${T}`)
    await gql(token, ARCHIVE_METRIC, { d: { metric_hash: retired.metric_hash } })
    expectCode(
      await gqlError(token, SET, { d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: retired.metric_hash, delta: 1 }] } }),
      'CAPITAL_METRIC_ARCHIVED',
    )

    const stored = await bindingsOf(issue.issue_hash)
    expect(stored.map(b => [b.metric_hash, b.delta])).toEqual([[calls.metric_hash, 7]])
  })

  it(caseName('cap.mm.bind.side.02', 'привязки чужой задачи пайщик не меняет; задачи, которой нет, — отказ «не найдено»'), async () => {
    const strangerToken = await tokenOf(ROLES.member())
    expectCode(
      await gqlError(strangerToken, SET, { d: { issue_hash: issue.issue_hash, bindings: [] } }),
      'CAPITAL_ISSUE_METRIC_LINK_FORBIDDEN',
    )
    expectCode(
      await gqlError(token, SET, { d: { issue_hash: 'd'.repeat(64), bindings: [] } }),
      'CAPITAL_ISSUE_NOT_FOUND',
    )
    expect(await bindingsOf(issue.issue_hash)).toHaveLength(1)
  })

  it(caseName('cap.mm.bind.happy.03', 'выполненная задача начисляет привязанное в цель; возврат в работу снимает начисленное'), async () => {
    const before = await factOf(calls.metric_hash)
    await setStatus(issue.issue_hash, 'DONE')
    expect(await factOf(calls.metric_hash)).toBe(before + 7)

    await setStatus(issue.issue_hash, 'IN_PROGRESS')
    expect(await factOf(calls.metric_hash), 'возврат в работу снял вклад задачи').toBe(before)
  })

  it(caseName('cap.mm.bind.side.03', 'у выполненной задачи привязки заперты'), async () => {
    await setStatus(issue.issue_hash, 'DONE')
    expectCode(
      await gqlError(token, SET, { d: { issue_hash: issue.issue_hash, bindings: [{ metric_hash: letters.metric_hash, delta: 1 }] } }),
      'CAPITAL_ISSUE_METRIC_LINKS_LOCKED_DONE',
    )
    const stored = await bindingsOf(issue.issue_hash)
    expect(stored.map(b => [b.metric_hash, b.delta])).toEqual([[calls.metric_hash, 7]])
  })
})
