/**
 * Права малых расширений по таблицам прав (C28-87, случаи *.rights.* в записях
 * реестра этих расширений): Стол бухгалтера, Стол связи, расходы,
 * кооперативный участок, карта кооператора, вычислительные ресурсы.
 *
 * Операции стоят под общим гардом каркаса расширений (`RightsGuard`) над
 * описанием прав своего расширения. Требование каждой операции тест читает из
 * исходника резолвера и сверяет, кому таблица его даёт.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { desktopGrantsOf, type AppRights } from '@coopenomics/extension-kit';
import { ReportsRights } from '~/extensions/reports/application/access/reports-rights';
import { ChatcoopRights } from '~/extensions/chatcoop/application/access/chatcoop-rights';
import { ExpensesRights } from '~/extensions/expenses/application/access/expenses-rights';
import { KuRights } from '~/extensions/ku/application/access/ku-rights';
import { CardcoopRights } from '~/extensions/cardcoop/application/access/cardcoop-rights';
import { PowerupRights } from '~/extensions/powerup/powerup-rights';
import { NO_RIGHT, candidate, chairman, councilMember, guardOver, participant, requirementAt, type Caller } from './core-rights.harness';

const EXTENSIONS = join(__dirname, '../../../src/extensions');
const registry = { register: jest.fn() } as any;
/** Бухгалтер: принятый пайщик, которому председатель назначил роль стола бухгалтера. */
const accountant: Caller = { username: 'olga', role: 'user', status: 'active' };
const roleAssignments = {
  declare: jest.fn(),
  attach: jest.fn(),
  rolesOf: jest.fn(async (_app: string, username: string) => (username === 'olga' ? ['accountant'] : [])),
} as any;

type Who = 'participant' | 'council' | 'chairman';
const CALLERS: Record<Who, Caller> = { participant, council: councilMember, chairman };
const ALL: Who[] = ['participant', 'council', 'chairman'];
const COUNCIL: Who[] = ['council', 'chairman'];
const CHAIR: Who[] = ['chairman'];

interface Suite {
  title: string;
  rights: AppRights<any, any>;
  dir: string;
  /** Операция → кому таблица её даёт; не названные операции — `rest`. */
  ops: Record<string, Who[]>;
  rest: Who[];
}

const SUITES: Suite[] = [
  {
    // Стол читает совет; черновики, формирование, реквизиты, отметки и налог ведёт председатель.
    title: 'Стол бухгалтера',
    rights: new ReportsRights(registry, roleAssignments),
    dir: 'reports/application/resolvers',
    ops: {
      getAvailableReports: COUNCIL,
      getReportPreview: COUNCIL,
      getReportHistory: COUNCIL,
      getReport: COUNCIL,
      getReportRequisites: COUNCIL,
      checkReportReadiness: COUNCIL,
      getReportCalendar: COUNCIL,
      getWithheldTaxState: COUNCIL,
      getWithheldTaxPayments: COUNCIL,
      // Реестры стола — собственные операции под правом стола (C28-90).
      reportsLedgerAccounts: COUNCIL,
      reportsLedgerWallets: COUNCIL,
      reportsLedgerHistory: COUNCIL,
      reportsLedgerPostings: COUNCIL,
      reportsProcess: COUNCIL,
      reportsProcesses: COUNCIL,
      reportsParticipants: COUNCIL,
      reportsParticipantWallets: COUNCIL,
      reportsSubjects: COUNCIL,
    },
    rest: CHAIR,
  },
  {
    title: 'Стол связи',
    rights: new ChatcoopRights(registry),
    dir: 'chatcoop/application/resolvers',
    ops: {
      chatcoopListCalendarRooms: COUNCIL,
      chatcoopCreateCalendarEvent: COUNCIL,
      chatcoopUpdateCalendarEvent: COUNCIL,
      chatcoopDeleteCalendarEvent: COUNCIL,
      chatcoopListSecretaryRooms: COUNCIL,
      chatcoopCreateSecretaryRoom: COUNCIL,
      chatcoopRemoveSecretaryRoom: COUNCIL,
    },
    rest: ALL,
  },
  {
    title: 'Расходы',
    rights: new ExpensesRights(registry),
    dir: 'expenses/application/resolvers',
    ops: {
      createExpenseProposal: COUNCIL,
      submitExpenseReport: COUNCIL,
      expenseRequisitesByProposal: COUNCIL,
      expenseProposalsByCooperative: COUNCIL,
      generateExpenseProposalDecisionDocument: CHAIR,
      payExpenseItem: CHAIR,
      overspendExpenseItem: CHAIR,
    },
    rest: ALL,
  },
  { title: 'Кооперативный участок', rights: new KuRights(registry), dir: 'ku/application/resolvers', ops: {}, rest: ALL },
  { title: 'Карта кооператора', rights: new CardcoopRights(), dir: 'cardcoop/application', ops: {}, rest: ALL },
];

/** Операции под общим гардом в резолверах каталога: файл и имя GraphQL. */
function operationsOf(dir: string): [string, string][] {
  const out: [string, string][] = [];
  for (const name of readdirSync(join(EXTENSIONS, dir)).filter((file) => file.endsWith('.resolver.ts'))) {
    const path = join(EXTENSIONS, dir, name);
    const src = readFileSync(path, 'utf8');
    for (const part of src.split(/^  @(?:Query|Mutation)\(/m).slice(1)) {
      const operation = /name: '(\w+)'/.exec(part)?.[1];
      if (operation && part.includes('@RequireRight(')) out.push([path, operation]);
    }
  }
  return out;
}

describe.each(SUITES)('$title: операции под общим гардом', ({ rights, dir, ops, rest }) => {
  const pass = guardOver(rights);
  const operations = operationsOf(dir);

  it('в резолверах не осталось операций под ролями', () => {
    expect(operations.length).toBeGreaterThan(0);
    for (const path of new Set(operations.map(([file]) => file))) {
      const code = readFileSync(path, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
      expect({ path, legacy: /@AuthRoles|RolesGuard/.test(code) }).toEqual({ path, legacy: false });
    }
  });

  it.each(operations)('%s %s: право есть у названных в таблице, остальным отказ', async (path, operation) => {
    const requirement = requirementAt(path, operation);
    const allowed = ops[operation] ?? rest;
    for (const who of ALL) {
      const caller = CALLERS[who];
      // Документы на своё имя: имя в запросе совпадает с вошедшим.
      const attempt = pass(requirement, caller, { data: { username: caller.username } });
      if (allowed.includes(who)) await expect(attempt).resolves.toBe(true);
      else await expect(attempt).rejects.toMatchObject(NO_RIGHT);
    }
    // Кандидат прав пайщика не имеет.
    await expect(pass(requirement, candidate, { data: { username: candidate.username } })).rejects.toMatchObject(NO_RIGHT);
  });
});

describe('кооперативный участок: документы участка', () => {
  const pass = guardOver(new KuRights(registry));
  const requirement = requirementAt(join(EXTENSIONS, 'ku/application/resolvers/ku.resolver.ts'), 'kuGenerateTrustedStatement');

  it('пайщик собирает документ на своё имя, совет — на имя любого пайщика', async () => {
    await expect(pass(requirement, participant, { data: { username: 'ivan' } })).resolves.toBe(true);
    await expect(pass(requirement, participant, { data: { username: 'petr' } })).rejects.toMatchObject({ code: 'KIT_RIGHT_SCOPE_OWN' });
    await expect(pass(requirement, councilMember, { data: { username: 'ivan' } })).resolves.toBe(true);
  });
});

describe('права страниц столов расширений', () => {
  const grantsOf = async (rights: AppRights<any, any>, caller: Caller) =>
    desktopGrantsOf(rights).resolveGrants({ username: caller.username, userRole: caller.role, userStatus: caller.status });

  it('Стол бухгалтера ведёт председатель, член совета его читает', async () => {
    const rights = new ReportsRights(registry, roleAssignments);
    expect(await grantsOf(rights, chairman)).toEqual(expect.arrayContaining(['Report:read', 'ReportCalendar:read', 'WithheldTax:read', 'ReportRequisites:manage']));
    // access.roles.happy.10
    expect((await grantsOf(rights, councilMember)).sort()).toEqual(['Registry:read', 'Report:read', 'ReportCalendar:read', 'ReportRequisites:read', 'WithheldTax:read']);
    expect(await grantsOf(rights, participant)).toEqual([]);
  });

  // access.roles.happy.09
  it('Стол бухгалтера целиком открыт пайщику с ролью бухгалтера', async () => {
    const rights = new ReportsRights(registry, roleAssignments);
    expect(await grantsOf(rights, accountant)).toEqual(expect.arrayContaining(await grantsOf(rights, chairman)));
    rights.onModuleInit();
    expect(roleAssignments.declare).toHaveBeenCalledWith('reports', [expect.objectContaining({ key: 'accountant' })]);
  });

  // access.roles.happy.13
  it('ревизор читает стол бухгалтера как член совета: ни одного права записи', async () => {
    const auditor: Caller = { username: 'revizor', role: 'user', status: 'active' };
    const assignments = { declare: jest.fn(), attach: jest.fn(), rolesOf: jest.fn(async () => ['auditor']) } as any;
    const rights = new ReportsRights(registry, assignments);
    expect((await grantsOf(rights, auditor)).sort()).toEqual(['Registry:read', 'Report:read', 'ReportCalendar:read', 'ReportRequisites:read', 'WithheldTax:read']);
    rights.onModuleInit();
    expect(assignments.attach).toHaveBeenCalledWith('reports', [expect.objectContaining({ key: 'auditor' })]);
  });

  // access.roles.side.08
  it('роль бухгалтера действует у принятого пайщика', async () => {
    const rights = new ReportsRights(registry, roleAssignments);
    expect(await grantsOf(rights, { ...accountant, status: 'registered' })).toEqual([]);
  });

  it('Стол связи: комнаты секретаря — страница совета', async () => {
    const rights = new ChatcoopRights(registry);
    expect(await grantsOf(rights, participant)).toEqual(expect.arrayContaining(['ChatAccount:manage:own', 'ChatRoom:read', 'Calendar:read', 'Transcription:read']));
    expect(await grantsOf(rights, participant)).not.toContain('SecretaryRoom:manage');
    expect(await grantsOf(rights, councilMember)).toContain('SecretaryRoom:manage');
    expect(await grantsOf(rights, candidate)).toEqual([]);
  });

  it('стол участка открыт принятому пайщику, вычислительные ресурсы — совету, их настройки — председателю', async () => {
    expect(await grantsOf(new KuRights(registry), participant)).toContain('KuDecision:read');
    expect(await grantsOf(new KuRights(registry), candidate)).toEqual([]);
    const powerup = new PowerupRights(registry);
    expect(await grantsOf(powerup, councilMember)).toEqual(['Powerup:read']);
    expect(await grantsOf(powerup, chairman)).toEqual(expect.arrayContaining(['Powerup:read', 'Powerup:manage']));
    expect(await grantsOf(powerup, participant)).toEqual([]);
  });
});
