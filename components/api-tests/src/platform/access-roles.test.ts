/**
 * Назначаемые роли снаружи: кассир и страница управления доступом (случаи
 * access.roles.* в test-registry/platform.access-roles.yaml).
 *
 * Роль объявляет приложение, назначает председатель. Пайщик с ролью кассира
 * получает стол кассира — кассу и реестр платежей — и их операции; стол
 * совета ему не выводится (с 16.10.2026, cashier.desk.*). После снятия роли
 * доступ закрыт.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf } from '../core'
import type { RightsProbe } from '../rights/probe'
import { NO_RIGHT, loadRightsProbe } from '../rights/probe'

const ROLE = 'cashier'
const ROLES_QUERY = 'query{ getAssignableRoles{ key title extension_name extension_title permissions{ title access } assignments{ username assigned_by } } }'
const ASSIGN = 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key assignments{ username assigned_by assigned_by_name } } }'
const REVOKE = 'mutation($d:RoleAssignmentInput!){ revokeRole(data:$d){ key assignments{ username } } }'
const DESKTOP = 'query{ getDesktop{ workspaces{ name extension_name grants } } }'
/** Страницы стола совета, которые роль кассира не открывает. */
const COUNCIL_PAGES = ['Agenda:read', 'Participant:read:all', 'Document:read:all', 'DocumentTemplate:read', 'Expense:read:all', 'Meet:create', 'Union:read']

const member: Who = ROLES.member()
const tokens: Record<string, string> = {}
let probe: RightsProbe

/** Права страниц стола приложения `extension` у вошедшего. */
async function deskGrants(token: string, extension: string): Promise<string[]> {
  const desk = (await gql<any>(token, DESKTOP)).getDesktop
  const workspace = (desk.workspaces as any[]).find(w => w.extension_name === extension)
  return (workspace?.grants as string[] | undefined) ?? []
}

const sovietGrants = (token: string): Promise<string[]> => deskGrants(token, 'soviet')
const chairmanDeskGrants = (token: string): Promise<string[]> => deskGrants(token, 'chairman')
const cashierGrants = (token: string): Promise<string[]> => deskGrants(token, 'cashier')

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
    // access.roles.happy.01, access.roles.happy.08: роль кассира объявлена под столом кассира
    // (до 16.10.2026 — под столом совета); карточка роли называет стол кассира.
    expect(roles.find(r => r.key === ROLE)).toMatchObject({ extension_name: 'cashier', extension_title: 'Стол кассира', title: expect.any(String) })
    // access.roles.happy.11: полномочия роли словами — что читает и что ведёт.
    const access = (key: string) => (roles.find(r => r.key === key)?.permissions as any[]).map(p => p.access).sort()
    // Четыре полномочия ядра и чтение служебных записок от расходов.
    expect(access(ROLE)).toEqual(['READ', 'READ', 'READ', 'WRITE', 'WRITE'])
    expect(access('accountant')).toEqual(['READ', 'READ', 'READ', 'READ', 'READ', 'WRITE', 'WRITE', 'WRITE', 'WRITE'])
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
    for (const name of ['getAvailableReports', 'getReportCalendar', 'getReportRequisites', 'getWithheldTaxState', 'reportsLedgerWallets', 'reportsProcesses'])
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
    expect(assigned.assignments).toContainEqual(expect.objectContaining({ username: member.account, assigned_by: CHAIRMAN.account }))
    // Карточка роли подписывает назначившего ФИО, а не учётным именем.
    const mine = assigned.assignments.find((a: any) => a.username === member.account)
    expect(mine.assigned_by_name).toBeTruthy()
    expect(mine.assigned_by_name).not.toBe(CHAIRMAN.account)
    // access.roles.side.03: повторное назначение второго держателя не создаёт.
    await gql(tokens[CHAIRMAN.account], ASSIGN, input(member.account))
    expect((await holders()).filter(name => name === member.account)).toHaveLength(1)
  }, 60_000)

  it(caseName('access.roles.happy.07', 'кассир получает стол кассира, страниц стола совета у него нет'), async () => {
    // cashier.desk.happy.02: на столе кассира — подтверждение оплаты и касса.
    const desk = await cashierGrants(tokens[member.account])
    expect(desk).toContain('Payment:read:all')
    expect(desk).toContain('Payment:confirm')
    expect(desk).toContain('ExpenseRegistry:read')
    // cashier.desk.side.02: стол совета кассиру не выводится.
    const soviet = await sovietGrants(tokens[member.account])
    for (const page of [...COUNCIL_PAGES, 'Payment:read:all', 'Payment:confirm'])
      expect(soviet, page).not.toContain(page)
  }, 60_000)

  it(caseName('cashier.desk.happy.08', 'стол кассира есть у председателя и закрыт члену совета'), async () => {
    expect(await cashierGrants(tokens[CHAIRMAN.account])).toContain('Payment:confirm')
    // cashier.desk.side.01: член совета читает реестр платежей на столе совета.
    expect(await cashierGrants(tokens[COUNCIL.account])).not.toContain('Payment:confirm')
    expect(await sovietGrants(tokens[COUNCIL.account])).toContain('Payment:read:all')
  }, 60_000)

  it(caseName('access.roles.happy.06', 'кассир проходит операции реестра платежей'), async () => {
    // access.roles.happy.02: права роли действуют сразу, без нового входа.
    // cashier.desk.happy.03: касса читает служебные записки кооператива, реквизиты получателей и авансы.
    for (const name of ['getPayments', 'setPaymentStatus', 'uploadPaymentProof', 'expenseProposalsByCooperative', 'expenseRequisitesByProposal', 'expenseAdvancesByCooperative'])
      expect(await probe.denial(tokens[member.account], name), name).toBeNull()
    // Решения и оплата записок кассиру не даны.
    for (const name of ['createExpenseProposal', 'payExpenseItem', 'submitExpenseReport'])
      expect(await probe.denial(tokens[member.account], name), name).toBe(NO_RIGHT)
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
      // access.roles.happy.12: реестры стол отдаёт собственными операциями под своим правом.
      for (const name of ['reportsLedgerAccounts', 'reportsLedgerWallets', 'reportsLedgerHistory', 'reportsLedgerPostings', 'reportsProcesses', 'reportsParticipants', 'reportsParticipantWallets', 'reportsSubjects'])
        expect(await probe.denial(tokens[member.account], name), name).toBeNull()
      // В ядре роль бухгалтера прав не даёт: бухгалтерия, пайщики и кошельки ядра закрыты.
      // Операции кассира здесь не проверяются: у пайщика в этот момент назначена и роль кассира.
      for (const name of ['getLedger2Wallets', 'getLedger2History', 'getAccounts', 'walmoveWallets'])
        expect(await probe.denial(tokens[member.account], name), name).toBe(NO_RIGHT)
      // Роль бухгалтера страниц стола совета не открывает.
      expect(await sovietGrants(tokens[member.account])).not.toContain('Agenda:read')
    }
    finally {
      await gql(tokens[CHAIRMAN.account], REVOKE, input(member.account, 'accountant'))
    }
    expect(await reportsGrants(tokens[member.account])).toEqual([])
    expect(await probe.denial(tokens[member.account], 'reportsLedgerWallets'), 'после снятия роли реестры закрыты').toBe(NO_RIGHT)
  }, 240_000)

  it(caseName('access.roles.happy.13', 'ревизор читает платежи и стол бухгалтера, ни одной записи'), async () => {
    const reportsGrants = async (token: string): Promise<string[]> => {
      const desk = (await gql<any>(token, DESKTOP)).getDesktop
      return ((desk.workspaces as any[]).find(w => w.extension_name === 'reports')?.grants as string[] | undefined) ?? []
    }
    const other: Who = ROLES.otherMember()
    const token = await tokenOf(other)
    await gql(tokens[CHAIRMAN.account], REVOKE, input(other.account, 'auditor'))
    expect(await sovietGrants(token)).not.toContain('Payment:read:all')
    const assigned = (await gql<any>(tokens[CHAIRMAN.account], ASSIGN, input(other.account, 'auditor'))).assignRole
    try {
      // Роль объявил стол совета, стол бухгалтера её дополнил: полномочия — только чтение.
      const roles = (await gql<any>(tokens[CHAIRMAN.account], ROLES_QUERY)).getAssignableRoles as any[]
      const auditor = roles.find(r => r.key === 'auditor')
      expect((auditor.permissions as any[]).every(p => p.access === 'READ')).toBe(true)
      expect((auditor.permissions as any[]).length).toBeGreaterThan(2)
      expect((assigned.assignments as any[]).map(a => a.username)).toContain(other.account)
      for (const name of ['getPayments', 'paymentProofs', 'getAvailableReports', 'getReportCalendar', 'getWithheldTaxState', 'reportsLedgerPostings', 'reportsProcesses', 'getDocuments', 'getAccounts', 'expenseProposalsByCooperative', 'documentTemplates', 'listReportDrafts', 'buildInitialReportEdits'])
        expect(await probe.denial(token, name), name).toBeNull()
      for (const name of ['setPaymentStatus', 'uploadPaymentProof', 'saveReportDraft', 'generateReportFromEdits', 'markReportPeriod', 'updateReportRequisites', 'payWithheldTax', 'assignRole', 'addParticipant', 'updateAccount', 'createExpenseProposal', 'payExpenseItem'])
        expect(await probe.denial(token, name), name).toBe(NO_RIGHT)
      const soviet = await sovietGrants(token)
      expect(soviet).toContain('Payment:read:all')
      expect(soviet).not.toContain('Payment:confirm')
      // Реестры документов, пайщиков и расходов стола совета ревизору открыты; повестка и собрания — нет.
      for (const page of ['Document:read:all', 'Participant:read:all', 'Expense:read:all']) expect(soviet, page).toContain(page)
      for (const page of ['Agenda:read', 'Meet:create', 'Participant:create']) expect(soviet, page).not.toContain(page)
      expect(await reportsGrants(token)).not.toContain('Report:draft')
    }
    finally {
      await gql(tokens[CHAIRMAN.account], REVOKE, input(other.account, 'auditor'))
    }
    expect(await probe.denial(token, 'reportsLedgerPostings')).toBe(NO_RIGHT)
  }, 240_000)

  it(caseName('access.roles.happy.04', 'после снятия роли доступ закрыт, повторное снятие проходит'), async () => {
    const revoked = (await gql<any>(tokens[CHAIRMAN.account], REVOKE, input(member.account))).revokeRole
    expect((revoked.assignments as any[]).map(a => a.username)).not.toContain(member.account)
    expect(await probe.denial(tokens[member.account], 'setPaymentStatus')).toBe(NO_RIGHT)
    expect(await probe.denial(tokens[member.account], 'expenseProposalsByCooperative')).toBe(NO_RIGHT)
    expect(await cashierGrants(tokens[member.account])).not.toContain('Payment:confirm')
    // access.roles.side.04: снятие роли, которой у пайщика нет, отказом не отвечает.
    expect(await gqlError(tokens[CHAIRMAN.account], REVOKE, input(member.account))).toBeNull()
  }, 120_000)
})
