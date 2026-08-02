import { TimeTrackingInteractor } from './time-tracking.interactor';
import type { TimeEntryRepository } from '../../domain/repositories/time-entry.repository';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { ContributorRepository } from '../../domain/repositories/contributor.repository';
import type { IssueRepository } from '../../domain/repositories/issue.repository';
import { TimeEntryDomainEntity } from '../../domain/entities/time-entry.entity';
import { TimerSessionDomainEntity } from '../../domain/entities/timer-session.entity';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import type { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { EMPTY_HASH } from '~/shared/utils/constants';

// Сценарии калиброваны по проду voskhod (issue CC7-1, estimate=15, 3 creators)
// чтобы локально воспроизводить найденные баги и предотвращать регрессию.

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeTimerSession(opts: {
  _id?: string;
  contributor_hash?: string;
  issue_hash?: string;
  project_hash?: string;
  started_at: Date;
  stopped_at?: Date | null;
  paused_at?: Date | null;
  total_paused_ms?: number;
}): TimerSessionDomainEntity {
  return new TimerSessionDomainEntity({
    _id: opts._id ?? 't1',
    contributor_hash: opts.contributor_hash ?? 'ant-hash',
    issue_hash: opts.issue_hash ?? 'i1',
    project_hash: opts.project_hash ?? 'project-hash-1',
    coopname: 'voskhod',
    started_at: opts.started_at,
    stopped_at: opts.stopped_at ?? null,
    paused_at: opts.paused_at ?? null,
    total_paused_ms: opts.total_paused_ms ?? 0,
  });
}

function makeContributor(
  username: string,
  hash: string,
  coopname = 'voskhod',
  hoursPerDay = 8
): ContributorDomainEntity {
  return {
    contributor_hash: hash,
    username,
    coopname,
    display_name: username,
    status: ContributorStatus.ACTIVE,
    hours_per_day: hoursPerDay,
  } as unknown as ContributorDomainEntity;
}

function makeProject(opts?: {
  project_hash?: string;
  origin?: ProjectOrigin;
}): ProjectDomainEntity {
  return {
    project_hash: opts?.project_hash ?? 'project-hash-1',
    origin: opts?.origin ?? ProjectOrigin.BLOCKCHAIN,
    coopname: 'voskhod',
    title: 'Test project',
    master: 'ant',
  } as unknown as ProjectDomainEntity;
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
  entry_type?: 'hourly' | 'estimate' | 'manual' | 'timer';
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
    sumCooperativeHoursByContributorAndDate: jest.fn().mockResolvedValue(0),
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
    findById: jest.fn().mockResolvedValue(null),
  };

  const timerSessionRepository = {
    create: jest.fn().mockImplementation(async (s: any) => ({ ...s, _id: s._id || 'timer-1' })),
    update: jest.fn().mockImplementation(async (s: any) => s),
    findOpenByContributor: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findAllOpen: jest.fn().mockResolvedValue([]),
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
    findByHash: jest.fn().mockResolvedValue(makeProject()),
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
    timerSessionRepository as any,
    logger
  );

  return {
    interactor,
    timeEntryRepository,
    contributorRepository,
    issueRepository,
    projectRepository,
    timerSessionRepository,
  };
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
  it('562-14: всегда no-op — авто-билеты отключены', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([
      makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] }),
    ]);
    await interactor.recalcDoneEstimatesForContributorProject('ant-hash', 'project-hash-1');
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
    expect(timeEntryRepository.findByIssueAndType).not.toHaveBeenCalled();
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
  it('562-14: откатывает committed, не пересобирает estimate-билеты', async () => {
    const { interactor, timeEntryRepository } = buildInteractor();
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

    await interactor.revertEntriesForDeclinedCommit('commit-bad');

    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).toHaveBeenCalledWith('commit-bad');
    expect(timeEntryRepository.deleteUncommittedByIssueHash).not.toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });

  it('идемпотентно: повторный вызов на коммит без записей — no-op', async () => {
    const { interactor, timeEntryRepository } = buildInteractor();
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([]);
    await interactor.revertEntriesForDeclinedCommit('commit-already-reverted');
    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).not.toHaveBeenCalled();
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

  it('сценарий full lifecycle: коммит → decline → revert возвращает часы без пересборки билетов', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    const doneIssue = makeIssue({ issue_hash: 'i1', estimate: 15, status: IssueStatus.DONE, creators: ['ant', 'smr', 'dvl'] });
    issueRepository.findCompletedByProjectAndCreators!.mockResolvedValue([doneIssue]);

    const initial = [
      makeEntry({ contributor_hash: 'ant-hash', issue_hash: 'i1', hours: 5, is_committed: false, entry_type: 'manual', _id: 'a1' }),
    ];
    timeEntryRepository.findUncommittedByProjectAndContributor.mockResolvedValue(initial);

    await interactor.commitTime('ant-hash', 'project-hash-1', 5, 'commit-ant');
    expect(timeEntryRepository.commitTimeEntries).toHaveBeenCalledTimes(1);

    const committedEntry = makeEntry({
      contributor_hash: 'ant-hash',
      issue_hash: 'i1',
      hours: 5,
      is_committed: true,
      entry_type: 'manual',
      commit_hash: 'commit-ant',
    });
    timeEntryRepository.findCommittedByCommitHash.mockResolvedValue([committedEntry]);
    timeEntryRepository.revertCommittedEntriesByCommitHash.mockResolvedValue(1);

    timeEntryRepository.create.mockClear();
    await interactor.revertEntriesForDeclinedCommit('commit-ant');

    expect(timeEntryRepository.revertCommittedEntriesByCommitHash).toHaveBeenCalledWith('commit-ant');
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });
});

describe('TimeTrackingInteractor.addWorklog / timer / trackTime (562-14)', () => {
  it('trackTime авто-стопит таймер при исчерпании hours_per_day', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository } = buildInteractor();
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    // Уже 7.5 ч сегодня, лимит 8 → остаток 0.5; elapsed 2 ч → стоп с 0.5
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(7.5);
    timerSessionRepository.findAllOpen.mockResolvedValue([
      makeTimerSession({ started_at: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
    ]);

    await interactor.trackTime();

    expect(timerSessionRepository.update).toHaveBeenCalled();
    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 0.5,
      entry_type: 'timer',
    });
  });

  it('addWorklog создаёт manual-запись на исполнителя', async () => {
    const { interactor, timeEntryRepository, contributorRepository, issueRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 5, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);

    await interactor.addWorklog({
      username: 'ant',
      coopname: 'voskhod',
      issue_hash: 'i1',
      hours: 2.5,
      date: '2026-07-26',
    });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 2.5,
      entry_type: 'manual',
      is_committed: false,
    });
  });

  it('addWorklog отклоняет не-исполнителя', async () => {
    const { interactor, contributorRepository, issueRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 5, status: IssueStatus.IN_PROGRESS, creators: ['smr'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));

    await expect(
      interactor.addWorklog({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1', hours: 1 })
    ).rejects.toThrow(/исполнителю/);
  });

  it('addWorklog без исполнителей просит назначить исполнителя', async () => {
    const { interactor, contributorRepository, issueRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: [] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));

    await expect(
      interactor.addWorklog({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1', hours: 1 })
    ).rejects.toThrow(/Назначьте исполнителя/);
  });

  it('startTimer при hours_per_day=0 разрешает старт', async () => {
    const { interactor, timerSessionRepository, contributorRepository, issueRepository, timeEntryRepository } =
      buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash', 'voskhod', 0));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);

    const session = await interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1' });
    expect(timerSessionRepository.create).toHaveBeenCalledTimes(1);
    expect(session.issue_hash).toBe('i1');
  });

  it('addWorklog не режется hours_per_day даже на кооперативном проекте', async () => {
    const { interactor, contributorRepository, issueRepository, timeEntryRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    // Уже 7 ч из 8 за день — ручная запись всё равно проходит (лимит только у таймера)
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(7);

    await interactor.addWorklog({
      username: 'ant',
      coopname: 'voskhod',
      issue_hash: 'i1',
      hours: 2,
      date: '2026-07-26',
    });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 2,
      entry_type: 'manual',
    });
    expect(timeEntryRepository.sumCooperativeHoursByContributorAndDate).not.toHaveBeenCalled();
  });

  it('startTimer создаёт сессию; повторный start на ту же задачу идемпотентен', async () => {
    const { interactor, timerSessionRepository, contributorRepository, issueRepository, timeEntryRepository } =
      buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);

    const session = await interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1' });
    expect(timerSessionRepository.create).toHaveBeenCalledTimes(1);
    expect(session.issue_hash).toBe('i1');

    timerSessionRepository.findOpenByContributor.mockResolvedValue({
      ...session,
      issue_hash: 'i1',
      contributor_hash: 'ant-hash',
      stopped_at: null,
    });
    timerSessionRepository.create.mockClear();
    const again = await interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1' });
    expect(timerSessionRepository.create).not.toHaveBeenCalled();
    expect(again.issue_hash).toBe('i1');
  });

  it('startTimer отклоняет старт при исчерпанном суточном лимите', async () => {
    const { interactor, contributorRepository, issueRepository, timeEntryRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i1', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(8);

    await expect(
      interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i1' })
    ).rejects.toThrow(/Суточный лимит/);
  });

  it('startTimer на другой задаче закрывает предыдущую сессию (allowEmpty)', async () => {
    const { interactor, timerSessionRepository, contributorRepository, issueRepository, timeEntryRepository } =
      buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i2', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);
    timerSessionRepository.findOpenByContributor.mockResolvedValue(
      makeTimerSession({ _id: 'old', started_at: new Date(Date.now() - 1000) })
    );

    await interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i2' });

    expect(timerSessionRepository.update).toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
    expect(timerSessionRepository.create).toHaveBeenCalled();
  });

  it('stopTimer пишет timer-запись с округлением до 0.01 ч', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);
    timerSessionRepository.findOpenByContributor.mockResolvedValue(
      makeTimerSession({ started_at: new Date(Date.now() - 90 * 60 * 1000) })
    );

    await interactor.stopTimer({ username: 'ant', coopname: 'voskhod' });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 1.5,
      entry_type: 'timer',
      is_committed: false,
    });
  });

  it('stopTimer короткой сессии гасит таймер без ошибки и без записи', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);
    timerSessionRepository.findOpenByContributor.mockResolvedValue(
      makeTimerSession({ _id: 't-short', started_at: new Date(Date.now() - 500) })
    );

    const entry = await interactor.stopTimer({ username: 'ant', coopname: 'voskhod' });

    expect(entry).toBeNull();
    expect(timerSessionRepository.update).toHaveBeenCalled();
    expect(timeEntryRepository.create).not.toHaveBeenCalled();
  });

  it('pauseTimer ставит паузу; resumeTimer продолжает', async () => {
    const { interactor, timerSessionRepository, contributorRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    const open = makeTimerSession({ started_at: new Date(Date.now() - 60 * 60 * 1000) });
    timerSessionRepository.findOpenByContributor.mockResolvedValue(open);
    timerSessionRepository.update.mockImplementation(async (s) => s);

    const paused = await interactor.pauseTimer({ username: 'ant', coopname: 'voskhod' });
    expect(paused.paused_at).toBeTruthy();

    open.paused_at = new Date(Date.now() - 10 * 60 * 1000);
    const resumed = await interactor.resumeTimer({ username: 'ant', coopname: 'voskhod' });
    expect(resumed.paused_at).toBeNull();
    expect(resumed.total_paused_ms).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50);
  });

  it('stopTimer после паузы не считает время паузы', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(0);
    const session = makeTimerSession({
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      paused_at: new Date(Date.now() - 60 * 60 * 1000),
    });
    timerSessionRepository.findOpenByContributor.mockResolvedValue(session);
    timerSessionRepository.update.mockImplementation(async (s) => s);

    await interactor.stopTimer({ username: 'ant', coopname: 'voskhod' });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 1,
      entry_type: 'timer',
    });
  });

  it('stopTimer режет часы по остатку hours_per_day (кооперативные проекты)', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository } = buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    // Уже 7 ч сегодня → из 3ч elapsed пишем только 1
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(7);
    timerSessionRepository.findOpenByContributor.mockResolvedValue(
      makeTimerSession({ started_at: new Date(Date.now() - 3 * 60 * 60 * 1000) })
    );

    await interactor.stopTimer({ username: 'ant', coopname: 'voskhod' });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 1,
      entry_type: 'timer',
    });
  });

  it('addWorklog на LOCAL-проекте создаёт manual-запись', async () => {
    const { interactor, contributorRepository, issueRepository, timeEntryRepository, projectRepository } =
      buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i-local', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    projectRepository.findByHash!.mockResolvedValue(makeProject({ origin: ProjectOrigin.LOCAL }));

    await interactor.addWorklog({
      username: 'ant',
      coopname: 'voskhod',
      issue_hash: 'i-local',
      hours: 3,
      date: '2026-07-26',
    });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 3,
      entry_type: 'manual',
    });
  });

  it('addWorklog на свободной задаче (пустой project_hash) создаёт manual-запись', async () => {
    const { interactor, contributorRepository, issueRepository, timeEntryRepository } = buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({
        issue_hash: 'i-free',
        project_hash: EMPTY_HASH,
        estimate: 0,
        status: IssueStatus.IN_PROGRESS,
        creators: ['ant'],
      })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));

    await interactor.addWorklog({
      username: 'ant',
      coopname: 'voskhod',
      issue_hash: 'i-free',
      hours: 4,
      date: '2026-07-26',
    });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 4,
      entry_type: 'manual',
    });
  });

  it('startTimer на LOCAL при исчерпанном coop-лимите разрешён', async () => {
    const { interactor, contributorRepository, issueRepository, timeEntryRepository, projectRepository } =
      buildInteractor();
    issueRepository.findByIssueHash!.mockResolvedValue(
      makeIssue({ issue_hash: 'i-local', estimate: 0, status: IssueStatus.IN_PROGRESS, creators: ['ant'] })
    );
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    projectRepository.findByHash!.mockResolvedValue(makeProject({ origin: ProjectOrigin.LOCAL }));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(8);

    await expect(
      interactor.startTimer({ username: 'ant', coopname: 'voskhod', issue_hash: 'i-local' })
    ).resolves.toBeTruthy();
    expect(timeEntryRepository.sumCooperativeHoursByContributorAndDate).not.toHaveBeenCalled();
  });

  it('stopTimer на LOCAL не режет elapsed по hours_per_day', async () => {
    const { interactor, timerSessionRepository, contributorRepository, timeEntryRepository, projectRepository } =
      buildInteractor();
    contributorRepository.findByUsernameAndCoopname!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    contributorRepository.findOne!.mockResolvedValue(makeContributor('ant', 'ant-hash'));
    projectRepository.findByHash!.mockResolvedValue(makeProject({ origin: ProjectOrigin.LOCAL }));
    timeEntryRepository.sumCooperativeHoursByContributorAndDate.mockResolvedValue(7);
    timerSessionRepository.findOpenByContributor.mockResolvedValue(
      makeTimerSession({ started_at: new Date(Date.now() - 3 * 60 * 60 * 1000) })
    );

    await interactor.stopTimer({ username: 'ant', coopname: 'voskhod' });

    expectEntryCreate(timeEntryRepository.create, {
      contributor_hash: 'ant-hash',
      hours: 3,
      entry_type: 'timer',
    });
    expect(timeEntryRepository.sumCooperativeHoursByContributorAndDate).not.toHaveBeenCalled();
  });
});
