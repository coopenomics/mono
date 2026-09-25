/**
 * Коммит Благороста через API (реестр capital.commits): часы по выполненной
 * задаче фиксируются взносом, и у взноса ровно одна строка в зеркале.
 *
 * До 25.09.2026 строка коммита записывалась после транзакции, а транзакция
 * ждёт свой блок: синхронизатор по дельте успевал завести строку сам, и
 * контроллер вставлял вторую с тем же хэшем (C28-80).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { COOP, caseName, gql, gqlError, tokenOf, waitFor } from '../core'
import { createIssue } from './cap-access.helpers'
import {
  capitalMember,
  clearance,
  createProject,
  ensureCapitalProgram,
  setMaster,
  startProject,
} from './cap-results.helpers'

const COMMIT = `mutation($d:CreateCommitInput!){ capitalCreateCommit(data:$d){
  commit_hash status blockchain_status present data
} }`
const COMMITS = `query($f:CapitalCommitFilter){ capitalCommits(filter:$f){ totalCount items{ commit_hash } } }`

const tag = Date.now().toString(36)
let member: Who
let token = ''
let active = ''
let idle = ''

/** Мастер проекта виден зеркалу — задачи в проекте заводит он. */
async function masterSeen(hash: string): Promise<void> {
  await waitFor(async () => {
    const d = await gql<any>(token, 'query($d:GetProjectInput!){ capitalProject(data:$d){ master } }', { d: { hash } })
    return d.capitalProject?.master === member.account ? true : null
  }, { timeoutMs: 60_000, intervalMs: 1_000, label: `мастер проекта ${hash.slice(0, 8)} в зеркале` })
}

/** Выполненная задача с часами участника — из неё берётся время коммита. */
async function doneIssueWithHours(project: string, hours: number): Promise<void> {
  const issue = await createIssue(member, { title: `Задача коммита ${tag}`, project_hash: project, creators: [member.account] })
  await gql(token, 'mutation($d:CapitalAddWorklogInput!){ capitalAddWorklog(data:$d){ hours } }',
    { d: { coopname: COOP, username: member.account, issue_hash: issue.issue_hash, hours } })
  await gql(token, 'mutation($d:UpdateIssueInput!){ capitalUpdateIssue(data:$d){ status } }',
    { d: { issue_hash: issue.issue_hash, status: 'DONE' } })
}

async function commitsOf(filter: Record<string, unknown>): Promise<{ totalCount: number, items: { commit_hash: string }[] }> {
  const d = await gql<any>(token, COMMITS, { f: filter })
  return d.capitalCommits
}

describe('Благорост: коммит часов через API', () => {
  beforeAll(async () => {
    await ensureCapitalProgram()
    member = await capitalMember('cmt')
    token = await tokenOf(member)

    active = await createProject(`Проект коммитов ${tag}`)
    await clearance(member, active)
    await setMaster(active, member)
    await startProject(active)
    await masterSeen(active)

    // Проект не запущен: контракт откажет в коммите, контроллер — нет.
    idle = await createProject(`Незапущенный проект коммитов ${tag}`)
    await clearance(member, idle)
    await setMaster(idle, member)
    await masterSeen(idle)
  })

  it(caseName('cap.commit.side.01', 'коммит сразу после ответа в зеркале с данными цепи — одна строка на хэш, снимок задач сохранён'), async () => {
    await doneIssueWithHours(active, 3)
    const d = await gql<any>(token, COMMIT, {
      d: { coopname: COOP, username: member.account, project_hash: active, commit_hours: 3, description: `Работа ${tag}`, meta: '{}' },
    })
    const commit = d.capitalCreateCommit
    expect(commit.present).toBe(true)
    expect(commit.blockchain_status).toBeTruthy()
    expect((commit.data as any[]).map(x => x.type)).toContain('committed_issues')

    const rows = await commitsOf({ commit_hash: commit.commit_hash })
    expect(rows.totalCount).toBe(1)
  })

  it(caseName('cap.commit.side.02', 'цепь отказала в коммите — строки в зеркале не остаётся, часы не списаны'), async () => {
    await doneIssueWithHours(idle, 2)
    const input = { coopname: COOP, username: member.account, project_hash: idle, commit_hours: 2, description: `Отказ ${tag}`, meta: '{}' }
    const refused = await gqlError(token, COMMIT, { d: input })
    expect(refused).not.toBeNull()
    expect((await commitsOf({ project_hash: idle, username: member.account })).totalCount).toBe(0)

    // Часы остались: повтор упирается в тот же отказ цепи, а не в «нет времени».
    const again = await gqlError(token, COMMIT, { d: input })
    expect(again?.code).not.toBe('CAPITAL_NO_AVAILABLE_COMMIT_TIME')
    expect(again?.message).toBe(refused?.message)
  })
})
