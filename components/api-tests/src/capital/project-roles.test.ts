/**
 * Благорост: кто управляет проектом (test-registry/capital.project-roles.yaml).
 *
 * Право на действие над проектом и задачей даёт таблица ролей проекта — та
 * же, по которой рабочий стол рисует кнопки: статус проекта и ведущего меняют
 * председатель и член совета, соавторов ведёт ещё и ведущий, задачу удаляет
 * ведущий, личный проект — его владелец. Председатель действует по своей
 * роли. До 03.10.2026 сервер пускал во все эти действия только председателя:
 * совет, ведущий и владелец видели кнопку и получали отказ.
 *
 * Мир теста: проект P в цепи, пайщики Mp и A с договором УХД и допуском,
 * задача в P с исполнителем — обычным пайщиком, личный проект пайщика.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, freshMember, gqlRaw, tokenOf, waitFor } from '../core'
import {
  admitted,
  createChainProject,
  createIssue,
  createLocalProject,
  ensureCapitalChainReady,
  projectAs,
  tag,
} from './cap-access.helpers'

const ROLE_DENIED = 'KIT_INSUFFICIENT_RIGHTS'

let T = ''
let P = ''
let Mp: Who
let author: Who
let member: Who
let issue: any

async function call(who: Who, query: string, data: Record<string, unknown>) {
  const r = await gqlRaw<any>(await tokenOf(who), query, { d: data })
  return { data: r.data, code: r.errors[0] ? String(r.errors[0].code) : null, http: r.errors[0]?.httpStatus ?? null, message: r.errors[0]?.message ?? '' }
}

const setMaster = (who: Who, master: Who) =>
  call(who, 'mutation($d:SetMasterInput!){ capitalSetMaster(data:$d){ __typename } }', { coopname: COOP, project_hash: P, master: master.account })
const addAuthor = (who: Who, who2: Who) =>
  call(who, 'mutation($d:AddAuthorInput!){ capitalAddAuthor(data:$d){ project_hash } }', { coopname: COOP, project_hash: P, author: who2.account })
const startProject = (who: Who) =>
  call(who, 'mutation($d:StartProjectInput!){ capitalStartProject(data:$d){ project_hash } }', { coopname: COOP, project_hash: P })
const deleteIssue = (who: Who, issueHash: string) =>
  call(who, 'mutation($d:DeleteCapitalIssueByHashInput!){ capitalDeleteIssue(data:$d) }', { issue_hash: issueHash })
const deleteProject = (who: Who, hash: string) =>
  call(who, 'mutation($d:DeleteProjectInput!){ capitalDeleteProject(data:$d){ __typename } }', { coopname: COOP, project_hash: hash })

beforeAll(async () => {
  await ensureCapitalChainReady()
  T = tag('roles')
  P = await createChainProject(`Роли ${T}`)
  Mp = freshMember({ prefix: 'caprm' })
  author = freshMember({ prefix: 'capra' })
  member = ROLES.member()
  await admitted(Mp, [P])
  await admitted(author, [P])
  issue = await createIssue(CHAIRMAN, { title: `Задача ${T}`, project_hash: P, creators: [member.account] })
}, 900_000)

describe('Благорост: кто управляет проектом', () => {
  it(caseName('cap.roles.happy.01', 'член совета назначает ведущего проекта'), async () => {
    const denied = await setMaster(member, Mp)
    expect(denied.code, `обычный пайщик ведущего не назначает: ${denied.message}`).toBe(ROLE_DENIED)

    const ok = await setMaster(COUNCIL, Mp)
    expect(ok.code, ok.message).toBeNull()
    await waitFor(async () => (await projectAs(CHAIRMAN, P))?.master === Mp.account ? true : null,
      { timeoutMs: 60_000, intervalMs: 1_000, label: `ведущий ${Mp.account} в зеркале` })
  })

  it(caseName('cap.roles.happy.02', 'ведущий проекта добавляет соавтора, обычный пайщик — нет'), async () => {
    const denied = await addAuthor(member, author)
    expect(denied.code, denied.message).toBe('CAPITAL_PROJECT_AUTHORS_FORBIDDEN')

    const ok = await addAuthor(Mp, author)
    expect(ok.code, ok.message).toBeNull()
    expect(ok.data.capitalAddAuthor.project_hash).toBe(P)
  })

  it(caseName('cap.roles.side.01', 'статус проекта меняет совет; ведущий без роли в совете получает отказ'), async () => {
    const denied = await startProject(Mp)
    expect(denied.code, denied.message).toBe(ROLE_DENIED)

    // Член совета проходит проверку прав: дальше решает состояние проекта в цепи.
    const council = await startProject(COUNCIL)
    expect([ROLE_DENIED, 'CAPITAL_PROJECT_STATUS_FORBIDDEN'], council.message).not.toContain(council.code)
    expect(council.http, council.message).not.toBe(403)
  })

  it(caseName('cap.roles.side.02', 'задачу удаляет ведущий проекта; исполнитель и член совета — нет'), async () => {
    const byExecutor = await deleteIssue(member, issue.issue_hash)
    expect(byExecutor.code, byExecutor.message).toBe('CAPITAL_ISSUE_DELETE_FORBIDDEN')
    const byCouncil = await deleteIssue(COUNCIL, issue.issue_hash)
    expect(byCouncil.code, byCouncil.message).toBe('CAPITAL_ISSUE_DELETE_FORBIDDEN')

    const byMaster = await deleteIssue(Mp, issue.issue_hash)
    expect(byMaster.code, byMaster.message).toBeNull()
    expect(byMaster.data.capitalDeleteIssue).toBe(true)
  })

  it(caseName('cap.roles.side.03', 'личный проект удаляет владелец; другой пайщик и член совета — нет'), async () => {
    const local = await createLocalProject(member, `Личный ${T}`)
    const byOther = await deleteProject(Mp, local.project_hash)
    expect(byOther.code, byOther.message).toBe('CAPITAL_PROJECT_DELETE_FORBIDDEN')
    const byCouncil = await deleteProject(COUNCIL, local.project_hash)
    expect(byCouncil.code, byCouncil.message).toBe('CAPITAL_PROJECT_DELETE_FORBIDDEN')
    expect(await projectAs(member, local.project_hash), 'проект на месте').not.toBeNull()

    const byOwner = await deleteProject(member, local.project_hash)
    expect(byOwner.code, byOwner.message).toBeNull()
  })
})
