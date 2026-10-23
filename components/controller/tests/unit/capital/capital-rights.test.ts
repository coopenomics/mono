/**
 * Права Благороста по таблице прав (C28-87, случаи cap.*.side.* «права по
 * таблице» в записях реестра Благороста).
 *
 * Перенос с прежних списков ролей один в один. Каждая строка ниже — операция и
 * её прежнее правило: уровень (`P` — принятый пайщик и совет, `C` — совет,
 * `H` — председатель, `S` — только на своё имя) и путь имени в запросе, по
 * которому прежний гард пропускал «на своё имя». Тест читает требование
 * операции из исходника резолвера и сверяет, что таблица даёт тот же исход.
 * Роль в проекте ведёт таблица ролей проекта в сервисах — здесь её нет.
 */
import { join } from 'node:path';

// Кооператив узла: трансляция паевого взноса временно открыта только в «Восходе».
let mockCoopname = 'voskhod';
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return { ...actual, platformSettings: () => ({ ...actual.platformSettings(), coopname: mockCoopname }) };
});
import { desktopGrantsOf } from '@coopenomics/extension-kit';
import { CAPITAL_SHARE_TRANSFER_ROLE, CapitalRights } from '~/extensions/capital/application/access/capital-rights';
import { NO_RIGHT, OWN, candidate, chairman, councilMember, guardOver, participant, requirementAt, type Caller } from '../rights/core-rights.harness';

const EXTENSIONS = join(__dirname, '../../../src/extensions');

type Level = 'P' | 'C' | 'H' | 'S';
const OPERATIONS: [string, string, Level, string][] = [
  ['capital/application/registration/resolvers/capital-registration.resolver.ts', 'capitalCandidates', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalUpdateMeasure', 'H', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMeasures', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalCreateComponentMetric', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalUpdateComponentMetric', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalArchiveComponentMetric', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalComponentMetrics', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalSetIssueMetricBindings', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalIssueMetricBindings', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalLogMetricContribution', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMetricContributions', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMetricSeries', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMetricWave', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMetricSuperposition', 'P', ''],
  ['capital/application/resolvers/component-metric.resolver.ts', 'capitalMetricSuperpositionHistory', 'P', ''],
  ['capital/application/resolvers/content-revision.resolver.ts', 'capitalGetContentRevisions', 'P', ''],
  ['capital/application/resolvers/content-revision.resolver.ts', 'capitalGetContentRevision', 'P', ''],
  ['capital/application/resolvers/content-revision.resolver.ts', 'capitalRestoreContentRevision', 'P', ''],
  ['capital/application/resolvers/contract-management.resolver.ts', 'capitalSetConfig', 'H', ''],
  ['capital/application/resolvers/contract-management.resolver.ts', 'capitalState', 'P', ''],
  ['capital/application/resolvers/debt-management.resolver.ts', 'capitalCreateDebt', 'S', 'data.username'],
  ['capital/application/resolvers/debt-management.resolver.ts', 'capitalDebts', 'P', 'filter.username'],
  ['capital/application/resolvers/debt-management.resolver.ts', 'capitalDebt', 'P', ''],
  ['capital/application/resolvers/debt-management.resolver.ts', 'capitalGenerateGetLoanStatement', 'C', 'data.username'],
  ['capital/application/resolvers/debt-management.resolver.ts', 'capitalGenerateGetLoanDecision', 'C', 'data.username'],
  ['capital/application/resolvers/distribution-management.resolver.ts', 'capitalFundProgram', 'H', ''],
  ['capital/application/resolvers/distribution-management.resolver.ts', 'capitalRefreshProgram', 'H', 'data.username'],
  ['capital/application/resolvers/distribution-management.resolver.ts', 'capitalGenerateGenerationConvertStatement', 'C', 'data.username'],
  ['capital/application/resolvers/distribution-management.resolver.ts', 'capitalGenerateCapitalizationToMainWalletConvertStatement', 'C', 'data.username'],
  ['capital/application/resolvers/expenses-management.resolver.ts', 'capitalCreateExpense', 'H', ''],
  ['capital/application/resolvers/expenses-management.resolver.ts', 'capitalExpenses', 'P', 'filter.username'],
  ['capital/application/resolvers/expenses-management.resolver.ts', 'capitalExpense', 'P', ''],
  ['capital/application/resolvers/expenses-management.resolver.ts', 'capitalGenerateExpenseStatement', 'C', 'data.username'],
  ['capital/application/resolvers/expenses-management.resolver.ts', 'capitalGenerateExpenseDecision', 'C', 'data.username'],
  ['capital/application/resolvers/favorites.resolver.ts', 'capitalFavorites', 'P', 'filter.username'],
  ['capital/application/resolvers/favorites.resolver.ts', 'capitalAddFavorite', 'P', 'data.username'],
  ['capital/application/resolvers/favorites.resolver.ts', 'capitalRemoveFavorite', 'P', 'data.username'],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCreateCommit', 'H', 'data.username'],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalApproveCommit', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalDeclineCommit', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCreateStory', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalUpdateStory', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCreateIssue', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalUpdateIssue', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalMoveIssueToComponent', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCreateCycle', 'H', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalStories', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalIssues', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCommits', 'P', 'filter.username'],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCycles', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalStory', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalIssue', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalCommit', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalDeleteStory', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalDeleteIssue', 'P', ''],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalGenerateGenerationMoneyInvestStatement', 'C', 'data.username'],
  ['capital/application/resolvers/generation.resolver.ts', 'capitalGenerateProgramMoneyInvestStatement', 'C', 'data.username'],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalCreateProjectInvest', 'S', 'data.username'],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalCreateProgramInvest', 'S', 'data.username'],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalAllocateFunds', 'H', ''],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalDeallocateFunds', 'H', ''],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalDeallocationLimit', 'H', ''],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalInvests', 'P', 'filter.username'],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalInvest', 'P', ''],
  ['capital/application/resolvers/invests-management.resolver.ts', 'capitalGenerateCapitalizationMoneyInvestStatement', 'C', 'data.username'],
  ['capital/application/resolvers/log.resolver.ts', 'getCapitalProjectLogs', 'P', ''],
  ['capital/application/resolvers/log.resolver.ts', 'getCapitalIssueLogs', 'P', ''],
  ['capital/application/resolvers/onboarding.resolver.ts', 'getCapitalOnboardingState', 'P', ''],
  ['capital/application/resolvers/onboarding.resolver.ts', 'completeCapitalOnboardingStep', 'H', ''],
  ['capital/application/resolvers/onboarding.resolver.ts', 'saveCapitalProgramDocDataHash', 'H', ''],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalRegisterContributor', 'H', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalImportContributor', 'H', ''],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalMakeClearance', 'H', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalEditContributor', 'H', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalContributors', 'P', 'filter.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalContributor', 'P', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalGenerateCapitalizationAgreement', 'C', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalGenerateGenerationContract', 'C', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalGenerateProjectGenerationContract', 'C', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalGenerateComponentGenerationContract', 'C', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalGenerateRegistrationDocuments', 'C', 'data.username'],
  ['capital/application/resolvers/participation-management.resolver.ts', 'capitalCompleteRegistration', 'H', 'data.username'],
  ['capital/application/resolvers/process.resolver.ts', 'capitalCreateProcessTemplate', 'C', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalUpdateProcessTemplate', 'C', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalDeleteProcessTemplate', 'C', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalGetProcessTemplates', 'P', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalGetProcessTemplate', 'P', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalStartProcess', 'P', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalCompleteProcessStep', 'P', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalGetProcessInstances', 'P', ''],
  ['capital/application/resolvers/process.resolver.ts', 'capitalGetProcessInstance', 'P', ''],
  ['capital/application/resolvers/program-expenses.resolver.ts', 'capitalCreateProgramExpense', 'C', ''],
  ['capital/application/resolvers/program-expenses.resolver.ts', 'capitalTopupProgramExpensePool', 'H', ''],
  ['capital/application/resolvers/program-expenses.resolver.ts', 'capitalProgramExpenses', 'C', ''],
  ['capital/application/resolvers/program-expenses.resolver.ts', 'capitalProgramExpense', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalCreateProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalCreateLocalProject', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalEditProject', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalSetMaster', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalAddAuthor', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalSetPlan', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalSetProjectPriority', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalSetProjectDevelopmentRepositoryUrl', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalStartProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalOpenProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalCloseProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalStopProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalFinalizeProject', 'C', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalDeleteProject', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalProjects', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalProject', 'P', ''],
  ['capital/application/resolvers/project-management.resolver.ts', 'capitalProjectWithRelations', 'P', ''],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalCreateProjectProperty', 'S', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalCreateProgramProperty', 'S', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateGenerationPropertyInvestStatement', 'C', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateGenerationPropertyInvestDecision', 'C', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateGenerationPropertyInvestAct', 'C', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateCapitalizationPropertyInvestStatement', 'C', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateCapitalizationPropertyInvestDecision', 'C', 'data.username'],
  ['capital/application/resolvers/property-management.resolver.ts', 'capitalGenerateCapitalizationPropertyInvestAct', 'C', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalPushResult', 'P', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalConvertSegment', 'C', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalResults', 'P', 'filter.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalResult', 'P', ''],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalGenerateResultContributionStatement', 'C', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalGenerateResultContributionDecision', 'C', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalGenerateResultContributionAct', 'C', 'data.username'],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalSignActAsContributor', 'P', ''],
  ['capital/application/resolvers/result-submission.resolver.ts', 'capitalSignActAsChairman', 'H', ''],
  ['capital/application/resolvers/segments.resolver.ts', 'capitalSegments', 'P', 'filter.username'],
  ['capital/application/resolvers/segments.resolver.ts', 'capitalSegment', 'P', 'filter.username'],
  ['capital/application/resolvers/segments.resolver.ts', 'capitalRefreshSegment', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalTimeStats', 'P', ''],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalTimeEntries', 'P', 'filter.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalTimeEntriesByIssues', 'P', 'filter.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalGetOpenTimer', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalAddWorklog', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalStartTimer', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalStopTimer', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalPauseTimer', 'P', 'data.username'],
  ['capital/application/resolvers/time-tracker.resolver.ts', 'capitalResumeTimer', 'P', 'data.username'],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalStartVoting', 'H', ''],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalSubmitVote', 'P', ''],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalCompleteVoting', 'H', ''],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalCalculateVotes', 'P', 'data.username'],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalVotes', 'P', ''],
  ['capital/application/resolvers/voting.resolver.ts', 'capitalVote', 'P', ''],
];

/** Ранг вошедшего и наименьший ранг, с которого уровень пропускает по роли. */
const RANKED: [Caller, number][] = [
  [candidate, 0],
  [participant, 1],
  [councilMember, 2],
  [chairman, 3],
];
const FLOOR: Record<Level, number> = { P: 1, C: 2, H: 3, S: 4 };

/** Аргументы операции с именем `username` по пути `data.username` / `filter.username` / `username`. */
function named(path: string, username: string): Record<string, unknown> {
  const keys = path.split('.');
  return keys.length === 1 ? { [keys[0]]: username } : { [keys[0]]: { [keys[1]]: username } };
}

/** Описание прав Благороста над подставными реестрами; `assigned` — назначенные председателем роли. */
function capitalRights(assigned: Record<string, string[]> = {}): CapitalRights {
  const roleAssignments = { declare: jest.fn(), rolesOf: jest.fn(async (_app: string, username: string) => assigned[username] ?? []) };
  return new CapitalRights({ register: jest.fn() } as any, roleAssignments as any);
}

describe('Благорост: операции под общим гардом', () => {
  const pass = guardOver(capitalRights());

  it('в таблице названа каждая операция резолверов', () => {
    expect(OPERATIONS).toHaveLength(147);
  });

  it.each(OPERATIONS)('%s %s: исход прежнего правила %s', async (file, operation, level, path) => {
    const requirement = requirementAt(join(EXTENSIONS, file), operation);
    for (const [caller, rank] of RANKED) {
      const byRole = rank >= FLOOR[level];
      // Чужое имя либо запрос без имени: проходит только роль.
      const foreign = pass(requirement, caller, path ? named(path, 'drugoy') : {});
      if (byRole) await expect(foreign).resolves.toBe(true);
      else await expect(foreign).rejects.toMatchObject(path ? OWN : NO_RIGHT);
      // Своё имя: проходит каждый вошедший, включая кандидата.
      if (path) await expect(pass(requirement, caller, named(path, caller.username))).resolves.toBe(true);
    }
  });
});

describe('Благорост: права страниц рабочего стола', () => {
  const grantsFor = async (caller: Caller) =>
    desktopGrantsOf(capitalRights()).resolveGrants({
      username: caller.username,
      userRole: caller.role,
      userStatus: caller.status,
    });

  it('страницы стола открыты каждому вошедшему, страницы совета — совету, настройки — председателю', async () => {
    expect(await grantsFor(candidate)).toContain('CapitalDesk:use');
    expect(await grantsFor(participant)).not.toContain('CapitalDesk:council');
    expect(await grantsFor(councilMember)).toContain('CapitalDesk:council');
    expect(await grantsFor(councilMember)).not.toContain('CapitalDesk:manage');
    expect(await grantsFor(chairman)).toEqual(expect.arrayContaining(['CapitalDesk:use', 'CapitalDesk:council', 'CapitalDesk:manage']));
  });
});

/**
 * Трансляция паевого взноса в Цифровой Кошелёк (случаи cap.share-transfer.*
 * в test-registry/capital.share-transfer.yaml): страница и операции открыты
 * председателю и пайщикам, которым он назначил роль «Трансляция паевого
 * взноса». Пайщик действует и читает историю только на своё имя.
 */
describe('Благорост: трансляция паевого взноса — доступ по роли', () => {
  const RESOLVER = join(EXTENSIONS, 'capital/application/resolvers/share-transfer.resolver.ts');
  const holder: Caller = { username: 'oleg', role: 'user', status: 'active' };
  const exited: Caller = { username: 'vera', role: 'user', status: 'exited' };
  const assigned = { [holder.username]: [CAPITAL_SHARE_TRANSFER_ROLE], [exited.username]: [CAPITAL_SHARE_TRANSFER_ROLE] };
  const pass = guardOver(capitalRights(assigned));
  const grantsFor = (caller: Caller) =>
    desktopGrantsOf(capitalRights(assigned)).resolveGrants({ username: caller.username, userRole: caller.role, userStatus: caller.status });

  it('страница трансляции есть у председателя и у пайщика с ролью, у остальных её нет', async () => {
    expect(await grantsFor(chairman)).toContain('CapitalDesk:transfer');
    expect(await grantsFor(holder)).toContain('CapitalDesk:transfer');
    for (const caller of [participant, councilMember, candidate, exited]) {
      expect(await grantsFor(caller)).not.toContain('CapitalDesk:transfer');
    }
  });

  it('пайщик с ролью транслирует свой взнос, чужой — нет', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalTransferShare');
    await expect(pass(requirement, holder, { data: { username: holder.username } })).resolves.toBe(true);
    await expect(pass(requirement, holder, { data: { username: 'drugoy' } })).rejects.toMatchObject(OWN);
  });

  it('пайщик без роли и член совета трансляцию не проводят даже на своё имя', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalTransferShare');
    for (const caller of [participant, councilMember, candidate]) {
      await expect(pass(requirement, caller, { data: { username: caller.username } })).rejects.toMatchObject(NO_RIGHT);
    }
  });

  it('вышедший из кооператива пайщик теряет доступ без снятия роли', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalTransferShare');
    await expect(pass(requirement, exited, { data: { username: exited.username } })).rejects.toMatchObject(NO_RIGHT);
  });

  it('председатель транслирует только свой взнос', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalTransferShare');
    await expect(pass(requirement, chairman, { data: { username: chairman.username } })).resolves.toBe(true);
    await expect(pass(requirement, chairman, { data: { username: holder.username } })).rejects.toMatchObject(OWN);
  });

  it('историю пайщик читает свою, председатель — всего кооператива', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalShareTransfers');
    await expect(pass(requirement, holder, { filter: { username: holder.username } })).resolves.toBe(true);
    await expect(pass(requirement, holder, {})).rejects.toMatchObject(OWN);
    await expect(pass(requirement, chairman, {})).resolves.toBe(true);
    await expect(pass(requirement, chairman, { filter: { username: holder.username } })).resolves.toBe(true);
  });

  it('остаток пайщик видит свой, чужой — только председатель', async () => {
    const requirement = requirementAt(RESOLVER, 'capitalShareTransferState');
    await expect(pass(requirement, holder, { data: { username: holder.username } })).resolves.toBe(true);
    await expect(pass(requirement, holder, { data: { username: 'drugoy' } })).rejects.toMatchObject(OWN);
    await expect(pass(requirement, chairman, { data: { username: holder.username } })).resolves.toBe(true);
    await expect(pass(requirement, participant, { data: { username: participant.username } })).rejects.toMatchObject(NO_RIGHT);
  });
});

describe('Благорост: трансляция паевого взноса — временно только в ПК «Восход»', () => {
  const RESOLVER = join(EXTENSIONS, 'capital/application/resolvers/share-transfer.resolver.ts');
  const holder: Caller = { username: 'oleg', role: 'user', status: 'active' };
  const assigned = { [holder.username]: [CAPITAL_SHARE_TRANSFER_ROLE] };

  afterEach(() => {
    mockCoopname = 'voskhod';
  });

  it('в другом кооперативе страницы нет ни у председателя, ни у держателя роли', async () => {
    mockCoopname = 'drugoycoop';
    const grantsFor = (caller: Caller) =>
      desktopGrantsOf(capitalRights(assigned)).resolveGrants({ username: caller.username, userRole: caller.role, userStatus: caller.status });
    expect(await grantsFor(chairman)).not.toContain('CapitalDesk:transfer');
    expect(await grantsFor(holder)).not.toContain('CapitalDesk:transfer');
    expect(await grantsFor(chairman)).toContain('CapitalDesk:manage');
  });

  it('в другом кооперативе трансляция закрыта и председателю', async () => {
    mockCoopname = 'drugoycoop';
    const pass = guardOver(capitalRights(assigned));
    const requirement = requirementAt(RESOLVER, 'capitalTransferShare');
    await expect(pass(requirement, chairman, { data: { username: chairman.username } })).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirement, holder, { data: { username: holder.username } })).rejects.toMatchObject(NO_RIGHT);
  });

  it('роль трансляции объявляется председателю только в «Восходе»', () => {
    const declareIn = (coop: string) => {
      mockCoopname = coop;
      const roleAssignments = { declare: jest.fn(), rolesOf: jest.fn(async () => []) };
      new CapitalRights({ register: jest.fn() } as any, roleAssignments as any).onModuleInit();
      return roleAssignments.declare.mock.calls.length;
    };
    expect(declareIn('voskhod')).toBe(1);
    expect(declareIn('drugoycoop')).toBe(0);
  });
});
