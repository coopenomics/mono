/**
 * Назначаемые роли снаружи: кассир и страница управления доступом (случаи
 * access.roles.* в test-registry/platform.access-roles.yaml).
 *
 * Роль объявляет приложение, назначает председатель. Пайщик с ролью кассира
 * получает из стола совета одну страницу — реестр платежей — и её операции;
 * после снятия роли доступ закрыт.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf } from '../core'
import type { RightsProbe } from '../rights/probe'
import { NO_RIGHT, loadRightsProbe } from '../rights/probe'

const ROLE = 'cashier'
const ROLES_QUERY = 'query{ getAssignableRoles{ key title extension_name permissions{ title access } assignments{ username assigned_by } } }'
const ASSIGN = 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key assignments{ username assigned_by } } }'
const REVOKE = 'mutation($d:RoleAssignmentInput!){ revokeRole(data:$d){ key assignments{ username } } }'
const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'
/** Страницы стола совета, которые роль кассира не открывает. */
const COUNCIL_PAGES = ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Expense:read:all', 'Meet:create', 'Union:read']

const member: Who = ROLES.member()
const tokens: Record<string, string> = {}
let probe: RightsProbe

async function sovietGrants(token: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === 'soviet')
  return (workspace?.grants as string[] | undefined) ?? []
}

async function chairmanDeskGrants(token: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === 'chairman')
  return (workspace?.grants as string[] | undefined) ?? []
}

async function holders(): Promise<string[]> {
  const roles = (await gql<any>(tokens[CHAIRMAN.account], ROLES_QUERY)).getAssignableRoles as any[]
  return (roles.find(r => r.key === ROLE)?.assignments as any[]).map(a => a.username)
}

const input = (username: string, role = ROLE) => ({ d: { username, role } })

beforeAll(async () => {
  for (const who of [CHAIRMAN, COUNCIL, member])
    tokens[who.account] = await tokenOf(who)
  probe = await loadRightsProbe(tokens[CHAIRMAN.account])
  // Стенд общий: прошлый прогон мог оставить роль назначенной.
  await gql(tokens[CHAIRMAN.account], REVOKE, input(member.account))
}, 180_000)

afterAll(async () => {
  await gql(tokens[CHAIRMAN.account], REVOKE, input(member.account))
}, 60_000)

describe('платформа: назначаемые роли и управление доступом', () => {
  it(caseName('access.roles.happy.05', 'председатель видит объявленные роли с приложением'), async () => {
    const roles = (await gql<any>(tokens[CHAIRMAN.account], ROLES_QUERY)).getAssignableRoles as any[]
    // access.roles.happy.01, access.roles.happy.08: роль кассира объявлена под столом совета.
    expect(roles.find(r => r.key === ROLE)).toMatchObject({ extension_name: 'soviet', title: expect.any(String) })
    // access.roles.happy.11: полномочия роли словами — что читает и что ведёт.
    const access = (key: string) => (roles.find(r => r.key === key)?.permissions as any[]).map(p => p.access).sort()
    expect(access(ROLE)).toEqual(['READ', 'READ', 'WRITE', 'WRITE'])
    expect(access('accountant')).toEqual(['READ', 'READ', 'READ', 'READ', 'READ', 'READ', 'WRITE', 'WRITE', 'WRITE', 'WRITE'])
  }, 60_000)

  it(caseName('core.acc.happy.12', 'страница управления доступом есть у председателя и закрыта совету и пайщику'), async () => {
    expect(await chairmanDeskGrants(tokens[CHAIRMAN.account])).toContain('AccessRole:manage')
    expect(await chairmanDeskGrants(tokens[COUNCIL.account])).not.toContain('AccessRole:manage')
    expect(await chairmanDeskGrants(tokens[member.account])).not.toContain('AccessRole:manage')
  }, 60_000)

  it(caseName('access.roles.side.07', 'управление доступом — только председатель'), async () => {
    for (const name of ['getAssignableRoles', 'assignRole', 'revokeRole']) {
      expect(await probe.denial(tokens[COUNCIL.account], name), `${name}: член совета`).toBe(NO_RIGHT)
      expect(await probe.denial(tokens[member.account], name), `${name}: пайщик`).toBe(NO_RIGHT)
    }
  }, 120_000)

  it(caseName('access.roles.side.05', 'пайщик без роли к реестру платежей не допущен'), async () => {
    expect(await probe.denial(tokens[member.account], 'setPaymentStatus')).toBe(NO_RIGHT)
    expect(await probe.denial(tokens[member.account], 'uploadPaymentProof')).toBe(NO_RIGHT)
    expect(await sovietGrants(tokens[member.account])).not.toContain('Payment:read:all')
  }, 120_000)

  it(caseName('access.roles.happy.10', 'член совета читает реестр платежей и стол бухгалтера, запись ему закрыта'), async () => {
    const council = tokens[COUNCIL.account]
    expect(await probe.denial(council, 'getPayments')).toBeNull()
    expect(await probe.denial(council, 'setPaymentStatus')).toBe(NO_RIGHT)
    expect(await probe.denial(council, 'uploadPaymentProof')).toBe(NO_RIGHT)
    for (const name of ['getAvailableReports', 'getReportCalendar', 'getReportRequisites', 'getWithheldTaxState'])
      expect(await probe.denial(council, name), name).toBeNull()
    for (const name of ['saveReportDraft', 'generateReportFromEdits', 'markReportPeriod', 'updateReportRequisites', 'payWithheldTax'])
      expect(await probe.denial(council, name), name).toBe(NO_RIGHT)
    // Председатель подтверждает оплату по своему праву.
    expect(await probe.denial(tokens[CHAIRMAN.account], 'setPaymentStatus')).toBeNull()
  }, 240_000)

  it(caseName('access.roles.break.03', 'необъявленную роль назначить нельзя'), async () => {
    expect((await gqlError(tokens[CHAIRMAN.account], ASSIGN, input(member.account, 'director')))?.code).toBe('ACCESS_ROLE_UNKNOWN')
  }, 60_000)

  it(caseName('access.roles.break.04', 'несуществующему пайщику роль не назначается'), async () => {
    expect((await gqlError(tokens[CHAIRMAN.account], ASSIGN, input('nosuchmember')))?.code).toBe('ACCESS_ROLE_PARTICIPANT_REQUIRED')
  }, 60_000)

  it(caseName('access.roles.happy.03', 'председатель назначает роль, повтор ничего не меняет'), async () => {
    const assigned = (await gql<any>(tokens[CHAIRMAN.account], ASSIGN, input(member.account))).assignRole
    expect(assigned.assignments).toContainEqual({ username: member.account, assigned_by: CHAIRMAN.account })
    // access.roles.side.03: повторное назначение второго держателя не создаёт.
    await gql(tokens[CHAIRMAN.account], ASSIGN, input(member.account))
    expect((await holders()).filter(name => name === member.account)).toHaveLength(1)
  }, 60_000)

  it(caseName('access.roles.happy.07', 'кассир получает из стола совета только реестр платежей'), async () => {
    const grants = await sovietGrants(tokens[member.account])
    expect(grants).toContain('Payment:read:all')
    expect(grants).toContain('Payment:confirm')
    for (const page of COUNCIL_PAGES)
      expect(grants, page).not.toContain(page)
  }, 60_000)

  it(caseName('access.roles.happy.06', 'кассир проходит операции реестра платежей'), async () => {
    // access.roles.happy.02: права роли действуют сразу, без нового входа.
    for (const name of ['getPayments', 'setPaymentStatus', 'uploadPaymentProof'])
      expect(await probe.denial(tokens[member.account], name), name).toBeNull()
  }, 120_000)

  it(caseName('access.roles.happy.09', 'бухгалтер получает стол бухгалтера целиком, после снятия роли стол закрыт'), async () => {
    const reportsGrants = async (token: string): Promise<string[]> => {
      const desk = (await gql<any>(token, DESKTOP)).getDesktop
      return ((desk.workspaces as any[]).find(w => w.extension_name === 'reports')?.grants as string[] | undefined) ?? []
    }
    const roles = (await gql<any>(tokens[CHAIRMAN.account], ROLES_QUERY)).getAssignableRoles as any[]
    expect(roles.find(r => r.key === 'accountant')).toMatchObject({ extension_name: 'reports' })
    expect(await reportsGrants(tokens[member.account])).toEqual([])
    await gql(tokens[CHAIRMAN.account], ASSIGN, input(member.account, 'accountant'))
    try {
      const chairmanGrants = await reportsGrants(tokens[CHAIRMAN.account])
      expect(chairmanGrants).toContain('Report:read')
      expect(await reportsGrants(tokens[member.account])).toEqual(expect.arrayContaining(chairmanGrants))
      // access.roles.happy.12: реестры стола берут данные операциями ядра — бухгалтеру они открыты.
      for (const name of ['getLedger2Wallets', 'getLedger2History', 'getLedger2Postings', 'getLedger2Accounts', 'processes', 'getAccounts'])
        expect(await probe.denial(tokens[member.account], name), name).toBeNull()
      // Перенос между кошельками и операции кассира роль бухгалтера не даёт.
      expect(await probe.denial(tokens[member.account], 'walmoveWallets')).toBe(NO_RIGHT)
      expect(await probe.denial(tokens[member.account], 'setPaymentStatus')).toBe(NO_RIGHT)
      // Роль бухгалтера страниц стола совета не открывает.
      expect(await sovietGrants(tokens[member.account])).not.toContain('Agenda:read')
    }
    finally {
      await gql(tokens[CHAIRMAN.account], REVOKE, input(member.account, 'accountant'))
    }
    expect(await reportsGrants(tokens[member.account])).toEqual([])
    expect(await probe.denial(tokens[member.account], 'getLedger2Wallets'), 'после снятия роли бухгалтерия закрыта').toBe(NO_RIGHT)
  }, 240_000)

  it(caseName('access.roles.happy.04', 'после снятия роли доступ закрыт, повторное снятие проходит'), async () => {
    const revoked = (await gql<any>(tokens[CHAIRMAN.account], REVOKE, input(member.account))).revokeRole
    expect((revoked.assignments as any[]).map(a => a.username)).not.toContain(member.account)
    expect(await probe.denial(tokens[member.account], 'setPaymentStatus')).toBe(NO_RIGHT)
    expect(await sovietGrants(tokens[member.account])).not.toContain('Payment:read:all')
    // access.roles.side.04: снятие роли, которой у пайщика нет, отказом не отвечает.
    expect(await gqlError(tokens[CHAIRMAN.account], REVOKE, input(member.account))).toBeNull()
  }, 120_000)
})
