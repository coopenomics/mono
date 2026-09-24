/**
 * Благорост: приоритеты проектов, компонентов и задач
 * (test-registry/capital.priorities.yaml).
 *
 * Приоритет ставит уровень выше: верхнему проекту — только председатель,
 * компоненту — председатель или ведущий родительского проекта (ведущий
 * самого компонента себе приоритет не ставит), задаче — председатель или
 * ведущий проекта; исполнитель задачи — нет.
 *
 * Мир теста: проект P в цепи с ведущим Mp и компонент K с ведущим Mk
 * (свежие пайщики с договором УХД и допуском), задача в компоненте, где
 * исполнитель — обычный пайщик.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, freshMember, gqlRaw, tokenOf } from '../core'
import { classify } from '../rights/classify'
import {
  ISSUE_FIELDS,
  admitted,
  createChainProject,
  createIssue,
  createLocalProject,
  ensureCapitalChainReady,
  projectAs,
  setMaster,
  tag,
} from './cap-access.helpers'

const FORBIDDEN = 'CAPITAL_PROJECT_PRIORITY_FORBIDDEN'

let T = ''
let P = ''
let K = ''
let Mp: Who
let Mk: Who
let executor: Who
let issue: any

async function setPriority(who: Who | null, hash: string, priority: string) {
  return gqlRaw<any>(who ? await tokenOf(who) : null,
    'mutation($d:SetCapitalProjectPriorityInput!){ capitalSetProjectPriority(data:$d){ project_hash priority } }',
    { d: { project_hash: hash, priority } })
}

async function setIssuePriority(who: Who, issueHash: string, priority: string) {
  return gqlRaw<any>(await tokenOf(who),
    `mutation($d:UpdateIssueInput!){ capitalUpdateIssue(data:$d){ ${ISSUE_FIELDS} } }`,
    { d: { issue_hash: issueHash, priority } })
}

async function issuePriority(issueHash: string): Promise<string> {
  const r = await gqlRaw<any>(await tokenOf(CHAIRMAN),
    'query($d:GetCapitalIssueByHashInput!){ capitalIssue(data:$d){ priority } }',
    { d: { issue_hash: issueHash } })
  return r.data.capitalIssue.priority
}

async function priorityOf(hash: string): Promise<string> {
  return (await projectAs(CHAIRMAN, hash))!.priority
}

beforeAll(async () => {
  await ensureCapitalChainReady()
  T = tag('prio')
  P = await createChainProject(`Приоритет ${T}`)
  K = await createChainProject(`Приоритет ${T} — компонент`, P)
  Mp = freshMember({ prefix: 'capp' })
  Mk = freshMember({ prefix: 'capk' })
  executor = ROLES.member()
  await admitted(Mp, [P])
  await setMaster(P, Mp)
  await admitted(Mk, [K])
  await setMaster(K, Mk)
  issue = await createIssue(CHAIRMAN, { title: `Задача ${T}`, project_hash: K, creators: [executor.account] })
}, 900_000)

describe('Благорост — приоритет проекта и компонента', () => {
  it(caseName('cap.prio.happy.01', 'председатель ставит приоритет проекту и компоненту, ведущий родителя — компоненту'), async () => {
    expect((await projectAs(CHAIRMAN, P))!.permissions.can_set_priority).toBe(true)
    // Хэш в верхнем регистре — приоритет всё равно ложится на тот же проект.
    const top = await setPriority(CHAIRMAN, P.toUpperCase(), 'URGENT')
    expect(top.errors).toEqual([])
    expect(top.data.capitalSetProjectPriority).toMatchObject({ project_hash: P, priority: 'URGENT' })
    expect(await priorityOf(P)).toBe('URGENT')

    expect((await setPriority(CHAIRMAN, K, 'LOW')).errors).toEqual([])
    expect(await priorityOf(K)).toBe('LOW')

    expect((await projectAs(Mp, K))!.permissions.can_set_priority).toBe(true)
    const byParentMaster = await setPriority(Mp, K, 'HIGH')
    expect(byParentMaster.errors).toEqual([])
    expect(await priorityOf(K)).toBe('HIGH')
  })

  it(caseName('cap.prio.break.01', 'ведущий и член совета не ставят приоритет верхнему проекту, ведущий компонента — компоненту'), async () => {
    const before = await priorityOf(P)
    for (const who of [Mp, COUNCIL]) {
      expect((await projectAs(who, P))!.permissions.can_set_priority).toBe(false)
      expect((await setPriority(who, P, 'LOW')).errors[0]?.code).toBe(FORBIDDEN)
    }
    expect(await priorityOf(P)).toBe(before)

    const componentBefore = await priorityOf(K)
    expect((await projectAs(Mk, K))!.master).toBe(Mk.account)
    expect((await projectAs(Mk, K))!.permissions.can_set_priority).toBe(false)
    expect((await setPriority(Mk, K, 'LOW')).errors[0]?.code).toBe(FORBIDDEN)
    expect(await priorityOf(K)).toBe(componentBefore)
  })

  it(caseName('cap.prio.break.02', 'без права мутация отказывает и приоритет не трогает'), async () => {
    const outsider = ROLES.otherMember()
    const before = await priorityOf(K)
    const target = before === 'MEDIUM' ? 'URGENT' : 'MEDIUM'
    expect((await setPriority(outsider, K, target)).errors[0]?.code).toBe(FORBIDDEN)
    expect(await priorityOf(K)).toBe(before)

    // Личный проект пайщика — его планирование: там право есть у владельца, но
    // не у постороннего, даже если хэш известен.
    const own = await createLocalProject(executor, `Личный ${T}`)
    expect(own.permissions.can_set_priority).toBe(true)
    expect((await setPriority(outsider, own.project_hash, 'URGENT')).errors[0]?.code).toBe(FORBIDDEN)
  })

  it(caseName('cap.prio.side.02', 'гость приоритет не ставит'), async () => {
    const before = await priorityOf(K)
    const r = await setPriority(null, K, 'URGENT')
    expect(classify(r.errors[0] ?? null)).toBe('deny-auth')
    expect(await priorityOf(K)).toBe(before)
  })
})

describe('Благорост — приоритет задачи', () => {
  it(caseName('cap.prio.side.01', 'приоритет задачи ставят председатель и ведущий родителя, исполнитель — нет'), async () => {
    const byChairman = await setIssuePriority(CHAIRMAN, issue.issue_hash, 'URGENT')
    expect(byChairman.errors).toEqual([])
    expect(byChairman.data.capitalUpdateIssue.priority).toBe('URGENT')

    const byParentMaster = await setIssuePriority(Mp, issue.issue_hash, 'LOW')
    expect(byParentMaster.errors).toEqual([])
    expect(await issuePriority(issue.issue_hash)).toBe('LOW')

    const byExecutor = await setIssuePriority(executor, issue.issue_hash, 'HIGH')
    expect(byExecutor.errors[0]?.code).toBe('CAPITAL_ISSUE_SET_PRIORITY_FORBIDDEN')
    expect(await issuePriority(issue.issue_hash)).toBe('LOW')
  })
})

describe('Благорост — очистка текста проекта на сервере', () => {
  it(caseName('cap.prior.show.01', 'скрипт в описании и приглашении проекта вырезается при записи'), async () => {
    const table = '| а | б |\n|---|---|\n| 1 | 2 |'
    const description = `Описание<script>fetch("/steal")</script> проекта\n\n${table}`
    const invite = 'Приглашение<iframe src="https://evil.example"></iframe> в проект'

    const local = await createLocalProject(executor, `Очистка ${T}`, '', { description, invite })
    expect(local.description).not.toContain('<script')
    expect(local.description).toContain(table)
    expect(local.invite).not.toContain('<iframe')
    expect(local.invite).toContain('Приглашение')

    const chain = await createChainProject(`Очистка в цепи ${T}`, undefined, { description, invite })
    const stored = await projectAs(CHAIRMAN, chain)
    expect(stored!.description).not.toContain('<script')
    expect(stored!.description).toContain(table)
    expect(stored!.invite).not.toContain('<iframe')
  })
})
