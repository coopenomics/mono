import { TimeTrackingInteractor } from './time-tracking.interactor';
import type { TimeEntryRepository } from '../../domain/repositories/time-entry.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { ContributorRepository } from '../../domain/repositories/contributor.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import { TimeEntryDomainEntity } from '../../domain/entities/time-entry.entity';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import type { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';

// Сценарии калиброваны по проду voskhod (issue CC7-1, estimate=15, 3 creators)
// чтобы локально воспроизводить найденные баги и предотвращать регрессию.

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeContributor(username: string, hash: string, coopname = 'voskhod'): ContributorDomainEntity {
  return {
    contributor_hash: hash,
    username,
    coopname,
    display_name: username,
    status: ContributorStatus.ACTIVE,
    hours_per_day: 8,
  } as unknown as ContributorDomainEntity;
}

function makeIssue(opts: {
  issue_hash: string;
  project_hash?: string;
  coopname?: string;
  estimate: number;
  status: IssueStatus;
  creators: string[];
  id?: string;
}): IssueDomainEntity {
  return {
    id: opts.id ?? 'TST-1',
    issue_hash: opts.issue_hash,
    project_hash: opts.project_hash ?? 'project-hash-1',
    coopname: opts.coopname ?? 'voskhod',
    title: 'Test issue',
    priority: IssuePriority.MEDIUM,
    status: opts.status,
    estimate: opts.estimate,
    creators: opts.creators,
    created_by: opts.creators[0] ?? 'ant',
    sort_order: 0,
    metadata: { labels: [], attachments: [] },
  } as unknown as IssueDomainEntity;
}

function makeEntry(opts: {
  contributor_hash: string;
  issue_hash: string;
  hours: number;
  is_committed: boolean;
  entry_type?: 'hourly' | 'estimate';
  estimate_snapshot?: number;
  commit_hash?: string;
  _id?: string;
  date?: string;
}): TimeEntryDomainEntity {
  return new TimeEntryDomainEntity({
    _id: opts._id ?? `e-${Math.random()}`,
    contributor_hash: opts.contributor_hash,
    issue_hash: opts.issue_hash,
    project_hash: 'project-hash-1',
    coopname: 'voskhod',
    date: opts.date ?? '2026-05-15',
    hours: opts.hours,
    is_committed: opts.is_committed,
    entry_type: opts.entry_type ?? 'estimate',
    estimate_snapshot: opts.estimate_snapshot,
    commit_hash: opts.commit_hash,
    block_num: 0,
    present: false,
    status: 'active',
  });
}

function buildInteractor() {
  const timeEntryRepository: Mocked<TimeEntryRepository> = {
    create: jest.fn().mockImplementation(async (e: TimeEntryDomainEntity) => e),
    findByContributorAndDate: jest.fn().mockResolvedValue([]),
    findUncommittedByContributor: jest.fn().mockResolvedValue([]),
    findUncommittedByProjectAndContributor: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation(async (e: TimeEntryDomainEntity) => e),
    updateMany: jest.fn().mockResolvedValue(undefined),
    getTotalUncommittedHours: jest.fn().mockResolvedValue(0),
    getContributorProjectStats: jest
      .fn()
      .mockResolvedValue({ total_committed_hours: 0, total_uncommitted_hours: 0 }),
    commitTimeEntries: jest.fn().mockResolvedValue(undefined),
    revertCommittedEntriesByCommitHash: jest.fn().mockResolvedValue(0),
    findCommittedByCommitHash: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteUncommittedByIssueHash: jest.fn().mockResolvedValue(undefined),
    findProjectsByContributor: jest.fn().mockResolvedValue([]),
    findContributorsByProject: jest.fn().mockResolvedValue([]),
    findByProjectWithPagination: jest
      .fn()
      .mockResolvedValue({ items: [], totalCount: 0, currentPage: 1, totalPages: 0 }),
    getAggregatedTimeEntriesByIssues: jest.fn().mockResolvedValue([]),
    getAggregatedTimeEntriesCount: jest.fn().mockResolvedValue(0),
    findByIssueAndType: jest.fn().mockResolvedValue([]),
    getTotalEstimateHoursByIssue: jest.fn().mockResolvedValue({ total: 0, estimate_snapshot: 0 }),
    hasCommittedTimeByIssueHash: jest.fn().mockResolvedValue(false),
    updateProjectHashByIssueHash: jest.fn().mockResolvedValue(undefined),
    getFactByIssues: jest.fn().mockResolvedValue(new Map()),
  };

  const contributorRepository: Partial<Mocked<ContributorRepository>> = {
    findByUsernameAndCoopname: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockResolvedValue(null),
    findByStatusAndCoopname: jest.fn().mockResolvedValue([]),
  };

  const issueRepository: Partial<Mocked<IssueRepository>> = {
    findByIssueHash: jest.fn().mockResolvedValue(null),
    findByStatus: jest.fn().mockResolvedValue([]),
    findByStatusAndCreators: jest.fn().mockResolvedValue([]),
    findCompletedByProjectAndCreators: jest.fn().mockResolvedValue([]),
  };

  const projectRepository: Partial<Mocked<ProjectRepository>> = {
    findAll: jest.fn().mockResolvedValue([]),
    findByHash: jest.fn().mockResolvedValue(null),
  };

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    verbose: jest.fn(),
  } as any;

  const interactor = new TimeTrackingInteractor(
    timeEntryRepository as unknown as TimeEntryRepository,
    projectRepository as unknown as ProjectRepository,
    contributorRepository as unknown as ContributorRepository,
    issueRepository as unknown as IssueRepository,
    logger
  );

  return { interactor, timeEntryRepository, contributorRepository, issueRepository, projectRepository };
}

function expectEntryCreate(
  mock: jest.Mock,
  expected: Partial<{ contributor_hash: string; hours: number; entry_type: string; is_committed: boolean }>
): void {
  const calls = mock.mock.calls.map((c) => c[0] as TimeEntryDomainEntity);
  const match = calls.find((entry) => {
    if (expected.contributor_hash && entry.contributor_hash !== expected.contributor_hash) return false;
    if (expected.hours !== undefined && Math.abs(entry.hours - expected.hours) > 1e-6) return false;
    if (expected.entry_type !== undefined && entry.entry_type !== expected.entry_type) return false;
    if (expected.is_committed !== undefined && entry.is_committed !== expected.is_committed) return false;
    return true;
  });
  if (!match) {
    const summary = calls
      .map((e) => `{contributor=${e.contributor_hash}, hours=${e.hours}, type=${e.entry_type}, committed=${e.is_committed}}`)
      .join('\n  ');
    throw new Error(`No create() call matched ${JSON.stringify(expected)}.\nActual calls:\n  ${summary}`);
  }
}

describe('TimeTrackingInteractor.applyExplicitEstimateToTimeEntries', () => {
  it('делит estimate поровну между creators при первой установке', async () => {
    const { interactor, timeEntryRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    timeEntryRepository.findByIssueAndType.mockResolvedValue([]);

    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);

    expect(timeEntryRepository.deleteUncommittedByIssueHash).toHaveBeenCalledWith('i1');
    expect(timeEntryRepository.create).toHaveBeenCalledTimes(3);
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'ant-hash', hours: 5, entry_type: 'estimate', is_committed: false });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'smr-hash', hours: 5, entry_type: 'estimate', is_committed: false });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'dvl-hash', hours: 5, entry_type: 'estimate', is_committed: false });
  });

  it('при estimate=0 только удаляет незакоммиченные, новых не создаёт', async () => {
    const { interactor, timeEntryRepository } = buildInteractor();
    const issue = makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.DONE, creators: ['ant'] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);
    expect(timeEntryRepository.deleteUncommittedByIssueHash).toHaveBeenCalledWith('i1');
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });

  it('БАГ #1: не даёт «двойную долю» creator-у, который уже закоммитил свою часть', async () => {
    // Прод-сценарий CC7-1: ant закоммитил полную долю (5 ч). При recalc/applyExplicit
    // его доля = 5 − 5 = 0 (а не 10/3 = 3.33 как было в баговой версии). Остальные
    // получают свои 5 ч, без «бонусной перераздачи остатка».
    const { interactor, timeEntryRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    timeEntryRepository.findByIssueAndType.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: true, entry_type: 'estimate', estimate_snapshot: 15 }),
    ]);

    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);

    // ant не должен получить uncommitted estimate (он уже закоммитил полную долю)
    const createCalls = timeEntryRepository.create.mock.calls.map((c) => c[0] as TimeEntryDomainEntity);
    const antEntries = createCalls.filter((e) => e.contributor_hash === 'ant-hash');
    expect(antEntries).toHaveLength(0);

    // Остальные двое получают по 5 ч каждый, а не 10/3
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'smr-hash', hours: 5 });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'dvl-hash', hours: 5 });
    expect(timeEntryRepository.create).toHaveBeenCalledTimes(2);
  });

  it('частичный committed уменьшает долю только этого creator', async () => {
    const { interactor, timeEntryRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    // Смуров закоммитил 3 из 5 → его остаток 2, у остальных по 5
    timeEntryRepository.findByIssueAndType.mockResolvedValue([
      makeEntry({ contributor_hash: 'smr-hash', issue_hash: 'i1', hours: 3, is_committed: true, entry_type: 'estimate', estimate_snapshot: 15 }),
    ]);
    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);

    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'ant-hash', hours: 5 });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'smr-hash', hours: 2 });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'dvl-hash', hours: 5 });
    expect(timeEntryRepository.create).toHaveBeenCalledTimes(3);
  });

  it('overcommitted (закоммичено больше доли) даёт 0, не отрицательное значение', async () => {
    const { interactor, timeEntryRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    timeEntryRepository.findByIssueAndType.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 8, is_committed: true, entry_type: 'estimate', estimate_snapshot: 15 }),
    ]);
    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);

    const antCreates = timeEntryRepository.create.mock.calls
      .map((c) => c[0] as TimeEntryDomainEntity)
      .filter((e) => e.contributor_hash === 'ant-hash');
    expect(antCreates).toHaveLength(0);
  });

  it('пустой список creators — удаляет uncommitted, не создаёт новых', async () => {
    const { interactor, timeEntryRepository } = buildInteractor();
    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: [] });
    await interactor.applyExplicitEstimateToTimeEntries(issue);
    expect(timeEntryRepository.deleteUncommittedByIssueHash).toHaveBeenCalledWith('i1');
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });
});

describe('TimeTrackingInteractor.recalcDoneEstimatesForContributorProject', () => {
  it('no-op если раскладка уже совпадает с планом', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([issue]);
    timeEntryRepository.findByIssueAndType.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
      makeEntry({ contributor_hash: 'smr-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
      makeEntry({ contributor_hash: 'dvl-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
    ]);
    await interactor.recalcDoneEstimatesForContributorProject('ant-hash', 'project-hash-1');
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });

  it('лечит раскладку 10/3 (баговую) обратно к 5/5/5 когда есть закоммитившие', async () => {
    // Воспроизведение прод-сценария CC7-1 после фикса: ant закоммитил 5 ч (committed),
    // в БД остались баговые 3.333 uncommitted у всех. Recalc должен снести их и
    // оставить ant=0, остальным по 5.
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    const issue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([issue]);
    timeEntryRepository.findByIssueAndType.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: true, entry_type: 'estimate', estimate_snapshot: 15 }),
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 3.3333333, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
      makeEntry({ contributor_hash: 'smr-hash', issue_hash: 'i1', hours: 3.3333333, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
      makeEntry({ contributor_hash: 'dvl-hash', issue_hash: 'i1', hours: 3.3333333, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15 }),
    ]);

    await interactor.recalcDoneEstimatesForContributorProject('ant-hash', 'project-hash-1');

    expect(timeEntryRepository.deleteUncommittedByIssueHash).toHaveBeenCalledWith('i1');
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'smr-hash', hours: 5 });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'dvl-hash', hours: 5 });
    // ant не получает uncommitted (он уже закоммитил свою долю)
    const antCreates = timeEntryRepository.create.mock.calls
      .map((c) => c[0] as TimeEntryDomainEntity)
      .filter((e) => e.contributor_hash === 'ant-hash');
    expect(antCreates).toHaveLength(0);
  });

  it('пропускает задачи без estimate', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.DONE, creators: ['ant'] }),
    ]);
    await interactor.recalcDoneEstimatesForContributorProject('ant-hash', 'project-hash-1');
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });
});

describe('TimeTrackingInteractor.commitTime', () => {
  it('БАГ #2: при partial split сохраняет entry_type=estimate и estimate_snapshot', async () => {
    // Прод-сценарий: у Смурова 3.333 ч estimate uncommitted, коммит 3 ч → split.
    // До фикса новая committed-запись создавалась с entry_type='hourly' (default).
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('smr', 'smr-hash'));
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] }),
    ]);
    const entry = makeEntry({
      contributor_hash: 'smr-hash',
      issue_hash: 'i1',
      hours: 5,
      is_committed: false,
      entry_type: 'estimate',
      estimate_snapshot: 15,
      _id: 'orig',
    });
    timeEntryRepository.findUncommittedByProjectAndContributor.mockResolvedValue([entry]);

    await interactor.commitTime('smr-hash', 'project-hash-1', 3, 'commit-hash-1');

    expect(timeEntryRepository.create).toHaveBeenCalledTimes(1);
    const created = timeEntryRepository.create.mock.calls[0][0] as TimeEntryDomainEntity;
    expect(created.is_committed).toBe(true);
    expect(created.hours).toBe(3);
    expect(created.entry_type).toBe('estimate');
    expect(created.estimate_snapshot).toBe(15);
    expect(created.commit_hash).toBe('commit-hash-1');

    expect(timeEntryRepository.update).toHaveBeenCalledTimes(1);
    const updated = timeEntryRepository.update.mock.calls[0][0] as TimeEntryDomainEntity;
    expect(updated._id).toBe('orig');
    expect(updated.hours).toBeCloseTo(2, 6);
  });

  it('full commit (entry.hours == requested) помечает оригинал, не создаёт split', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] }),
    ]);
    timeEntryRepository.findUncommittedByProjectAndContributor.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15, _id: 'orig' }),
    ]);

    await interactor.commitTime('ant-hash', 'project-hash-1', 5, 'commit-hash-2');

    expect(timeEntryRepository.create).not.toHaveBeenCalled();
    expect(timeEntryRepository.commitTimeEntries).toHaveBeenCalledTimes(1);
  });

  it('коммит только по DONE задачам — отфильтровывает entries по активным задачам', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    // Только i1 в DONE, i2 в IN_PROGRESS
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant'] }),
    ]);
    timeEntryRepository.findUncommittedByProjectAndContributor.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate' }),
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i2', hours: 3, is_committed: false, entry_type: 'hourly' }),
    ]);

    await interactor.commitTime('ant-hash', 'project-hash-1', 3, 'commit-hash-3');

    // Должен коммитить из i1 (DONE), не из i2
    const committedArgs = timeEntryRepository.commitTimeEntries.mock.calls[0]?.[0] as TimeEntryDomainEntity[] | undefined;
    const splitCreate = timeEntryRepository.create.mock.calls[0]?.[0] as TimeEntryDomainEntity | undefined;
    const touchedIssues = new Set<string>();
    committedArgs?.forEach((e) => touchedIssues.add(e.issue_hash));
    if (splitCreate) touchedIssues.add(splitCreate.issue_hash);
    expect(touchedIssues.has('i2')).toBe(false);
  });
});

describe('TimeTrackingInteractor.revertEntriesForDeclinedCommit', () => {
  it('БАГ #3: вызывает revert + нормализует раскладку по затронутой DONE-задаче', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    const reverted = makeEntry({
      contributor_hash: 'ant-hash',
      issue_hash: 'i1',
      hours: 5,
      is_committed: true,
      entry_type: 'estimate',
      estimate_snapshot: 15,
      commit_hash: 'commit-bad',
    });
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([reverted]);
    timeEntryRepository.revertCommittedEntriesByCommitHash.mockResolvedValue(1);
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] })
    );
    // После revert у ant'a 0 committed (revert убрал) — поэтому новая раскладка 5/5/5
    timeEntryRepository.findByIssueAndType.mockResolvedValue([]);

    await interactor.revertEntriesForDeclinedCommit('commit-bad');

    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).toHaveBeenCalledWith('commit-bad');
    expect(timeEntryRepository.deleteUncommittedByIssueHash).toHaveBeenCalledWith('i1');
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'ant-hash', hours: 5, entry_type: 'estimate' });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'smr-hash', hours: 5, entry_type: 'estimate' });
    expectEntryCreate(timeEntryRepository.create, { contributor_hash: 'dvl-hash', hours: 5, entry_type: 'estimate' });
  });

  it('идемпотентно: повторный вызов на коммит без записей — no-op', async () => {
    const { interactor, timeEntryRepository } = buildInteractor();
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([]);
    await interactor.revertEntriesForDeclinedCommit('commit-already-reverted');
    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
  });

  it('не пересчитывает задачи которые больше не DONE', async () => {
    const { interactor, timeEntryRepository, issueRepository } = buildInteractor();
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 3, is_committed: true, entry_type: 'estimate', estimate_snapshot: 15, commit_hash: 'c1' }),
    ]);
    timeEntryRepository.revertCommittedEntriesByCommitHash.mockResolvedValue(1);
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    await interactor.revertEntriesForDeclinedCommit('c1');
    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).toHaveBeenCalled();
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });
});

describe('integration scenario: CC7-1 прод-инцидент', () => {
  it('после декларации estimate=15 на 3 creators даёт по 5 ч каждому, total uncommitted=15', async () => {
    const { interactor, timeEntryRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    const issue = makeIssue({
      issue_hash: 'cc7-1-hash',
      estimate: 15,
      status: IssueStatus.DONE,
      creators: ['ant', 'zxfevlujlica', 'ipesgnlxmnwx'],
    });
    timeEntryRepository.findByIssueAndType.mockResolvedValue([]);

    await interactor.applyExplicitEstimateToTimeEntries(issue);

    const creates = timeEntryRepository.create.mock.calls.map((c) => c[0] as TimeEntryDomainEntity);
    expect(creates).toHaveLength(3);
    const totalHours = creates.reduce((s, e) => s + e.hours, 0);
    expect(totalHours).toBeCloseTo(15, 6);
    creates.forEach((e) => {
      expect(e.hours).toBeCloseTo(5, 6);
      expect(e.entry_type).toBe('estimate');
      expect(e.is_committed).toBe(false);
      expect(e.estimate_snapshot).toBe(15);
    });
  });

  it('сценарий full lifecycle: коммит → decline → revert восстанавливает доступное время', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findByUsernameAndCoopname!.mockImplementation(async (u: string) =>
      makeContributor(u, `${u}-hash`)
    );
    const doneIssue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([doneIssue]);
    issueRepository.findByIssueHash!.mockResolvedValue(doneIssue);

    // 1. Стартовое состояние: 5/5/5 uncommitted
    const initial = [
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'estimate', estimate_snapshot: 15, _id: 'a1' }),
    ];
    timeEntryRepository.findUncommittedByProjectAndContributor.mockResolvedValue(initial);

    // 2. ant коммитит свои 5 ч
    await interactor.commitTime('ant-hash', 'project-hash-1', 5, 'commit-ant');
    expect(timeEntryRepository.commitTimeEntries).toHaveBeenCalledTimes(1);

    // 3. Симулируем что в БД теперь есть committed estimate 5 ч от ant'a
    const committedEntry = makeEntry({
      contributor_hash: 'ant-hash',
      issue_hash: 'i1',
      hours: 5,
      is_committed: true,
      entry_type: 'estimate',
      estimate_snapshot: 15,
      commit_hash: 'commit-ant',
    });
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([committedEntry]);
    timeEntryRepository.revertCommittedEntriesByCommitHash.mockResolvedValue(1);
    // После revert у ant'а 0 committed estimate → новая раскладка 5/5/5
    timeEntryRepository.findByIssueAndType.mockResolvedValue([]);

    // 4. Decline → revert
    timeEntryRepository.create.mockClear();
    timeEntryRepository.deleteUncommittedByIssueHash.mockClear();
    await interactor.revertEntriesForDeclinedCommit('commit-ant');

    // 5. После revert: 5/5/5 uncommitted
    const creates = timeEntryRepository.create.mock.calls.map((c) => c[0] as TimeEntryDomainEntity);
    const total = creates.reduce((s, e) => s + e.hours, 0);
    expect(total).toBeCloseTo(15, 6);
    expect(creates.every((e) => e.entry_type === 'estimate' && !e.is_committed)).toBe(true);
  });
});
