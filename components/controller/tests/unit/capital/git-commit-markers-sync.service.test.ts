import { GitCommitMarkersSyncService } from '../../../src/extensions/capital/application/services/git-commit-markers-sync.service';
import { computeGitPatchId } from '../../../src/extensions/capital/application/utils/git-patch-id';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

const ISSUE = {
  issue_hash: 'a'.repeat(64),
  project_hash: 'b'.repeat(64),
};

const commitRow = (sha: string, message: string) => ({
  sha,
  parents: ['0'.repeat(40)],
  commit: { message, author: { date: '2026-08-19T10:00:00Z' } },
});

const PATCH = '--- src/a.ts\n@@ -1,1 +1,2 @@\n+added line';

function buildService(overrides: {
  linked?: Partial<Record<string, jest.Mock>>;
  github?: Partial<Record<string, jest.Mock>>;
  state?: { last_synced_tip_sha: string | null } | null;
}) {
  const githubService = {
    isAvailable: jest.fn().mockReturnValue(true),
    getLatestCommit: jest.fn().mockResolvedValue('head'.padEnd(40, '0')),
    listCommitsBetweenBaseAndHead: jest.fn().mockResolvedValue([]),
    listAllCommitsOnBranchOldestFirst: jest.fn().mockResolvedValue([]),
    getCommitPatchesConcat: jest.fn().mockResolvedValue(PATCH),
    ...overrides.github,
  };
  const issueRepository = {
    findByIssueHash: jest.fn().mockResolvedValue(ISSUE),
    findByCoopnameAndClientId: jest.fn().mockResolvedValue(ISSUE),
  };
  const linkedCommitRepository = {
    findByAnySha: jest.fn().mockResolvedValue(null),
    findByPatchIdentity: jest.fn().mockResolvedValue(null),
    insertLinkedCommit: jest.fn().mockResolvedValue(undefined),
    registerShaAlias: jest.fn().mockResolvedValue(undefined),
    promoteToDefaultBranch: jest.fn().mockResolvedValue(undefined),
    ...overrides.linked,
  };
  const syncStateRepository = {
    getState: jest
      .fn()
      .mockResolvedValue(
        overrides.state !== undefined ? overrides.state : { last_synced_tip_sha: 'tip'.padEnd(40, '0') }
      ),
    setTipSha: jest.fn().mockResolvedValue(undefined),
  };
  const userRepository = {
    findByUsername: jest.fn().mockResolvedValue({ username: 'ant' }),
  };
  const service = new GitCommitMarkersSyncService(
    githubService as any,
    issueRepository as any,
    linkedCommitRepository as any,
    syncStateRepository as any,
    userRepository as any
  );
  return { service, githubService, linkedCommitRepository, syncStateRepository };
}

const syncArgs = (branch: string) => ({
  owner: 'coopenomics',
  repo: 'mono',
  branch,
  defaultBranch: 'dev',
  githubRepositoryKey: 'https://github.com/coopenomics/mono',
});

describe('GitCommitMarkersSyncService — мульти-веточный ingest', () => {
  it('новый маркированный коммит фича-ветки записывается сразу и не как канонический', async () => {
    const commit = commitRow('1'.repeat(40), '[25C-2][@ant] feat: правка');
    const { service, linkedCommitRepository } = buildService({
      github: { listCommitsBetweenBaseAndHead: jest.fn().mockResolvedValue([commit]) },
    });

    await service.syncMarkedCommits(syncArgs('feat/x'));

    expect(linkedCommitRepository.insertLinkedCommit).toHaveBeenCalledTimes(1);
    const row = linkedCommitRepository.insertLinkedCommit.mock.calls[0][0];
    expect(row.in_default_branch).toBe(false);
    expect(row.first_seen_branch).toBe('feat/x');
    expect(row.patch_id).toBe(computeGitPatchId(PATCH));
  });

  it('повторная встреча того же SHA на базовой ветке не создаёт строку, а помечает её канонической', async () => {
    const sha = '2'.repeat(40);
    const commit = commitRow(sha, '[25C-2][@ant] feat: правка');
    const { service, linkedCommitRepository } = buildService({
      github: { listCommitsBetweenBaseAndHead: jest.fn().mockResolvedValue([commit]) },
      linked: {
        findByAnySha: jest.fn().mockResolvedValue({ id: 'row-1', in_default_branch: false }),
      },
    });

    await service.syncMarkedCommits(syncArgs('dev'));

    expect(linkedCommitRepository.insertLinkedCommit).not.toHaveBeenCalled();
    expect(linkedCommitRepository.promoteToDefaultBranch).toHaveBeenCalledWith(
      expect.objectContaining({ linkedCommitId: 'row-1', canonicalSha: sha })
    );
  });

  it('переписанный коммит (новый SHA, та же правка) уходит SHA-алиасом, не второй строкой', async () => {
    const sha = '3'.repeat(40);
    const commit = commitRow(sha, '[25C-2][@ant] feat: правка');
    const { service, linkedCommitRepository } = buildService({
      github: { listCommitsBetweenBaseAndHead: jest.fn().mockResolvedValue([commit]) },
      linked: {
        findByPatchIdentity: jest
          .fn()
          .mockResolvedValue({ id: 'row-orig', github_sha: '9'.repeat(40), in_default_branch: false }),
      },
    });

    await service.syncMarkedCommits(syncArgs('dev'));

    expect(linkedCommitRepository.insertLinkedCommit).not.toHaveBeenCalled();
    expect(linkedCommitRepository.registerShaAlias).toHaveBeenCalledWith(
      expect.objectContaining({ linkedCommitId: 'row-orig', githubSha: sha })
    );
    expect(linkedCommitRepository.promoteToDefaultBranch).toHaveBeenCalledWith(
      expect.objectContaining({ linkedCommitId: 'row-orig', canonicalSha: sha })
    );
  });

  it('merge-коммит пропускается', async () => {
    const merge = {
      sha: '4'.repeat(40),
      parents: ['a'.repeat(40), 'b'.repeat(40)],
      commit: { message: '[25C-2][@ant] merge', author: { date: '2026-08-19T10:00:00Z' } },
    };
    const { service, linkedCommitRepository } = buildService({
      github: { listCommitsBetweenBaseAndHead: jest.fn().mockResolvedValue([merge]) },
    });

    await service.syncMarkedCommits(syncArgs('dev'));

    expect(linkedCommitRepository.insertLinkedCommit).not.toHaveBeenCalled();
    expect(linkedCommitRepository.registerShaAlias).not.toHaveBeenCalled();
  });

  it('первый заход на небазовую ветку индексирует только коммиты впереди базовой', async () => {
    const compareMock = jest.fn().mockResolvedValue([commitRow('6'.repeat(40), '[25C-2][@ant] feat: правка')]);
    const { service, githubService, linkedCommitRepository } = buildService({
      state: null,
      github: { listCommitsBetweenBaseAndHead: compareMock },
    });

    await service.syncMarkedCommits(syncArgs('feat/y'));

    expect(githubService.listAllCommitsOnBranchOldestFirst).not.toHaveBeenCalled();
    expect(compareMock).toHaveBeenCalledWith('coopenomics', 'mono', 'dev', expect.any(String));
    expect(linkedCommitRepository.insertLinkedCommit).toHaveBeenCalledTimes(1);
  });

  it('переданный HEAD ветки используется как есть — отдельный запрос за ним не идёт', async () => {
    const head = '7'.repeat(40);
    const compareMock = jest.fn().mockResolvedValue([]);
    const { service, githubService, syncStateRepository } = buildService({
      github: { listCommitsBetweenBaseAndHead: compareMock },
    });

    await service.syncMarkedCommits({ ...syncArgs('feat/z'), headSha: head });

    expect(githubService.getLatestCommit).not.toHaveBeenCalled();
    expect(compareMock).toHaveBeenCalledWith('coopenomics', 'mono', 'tip'.padEnd(40, '0'), head);
    expect(syncStateRepository.setTipSha).toHaveBeenCalledWith(
      'voskhod',
      'https://github.com/coopenomics/mono',
      'feat/z',
      head
    );
  });

  it('HEAD ветки совпал с курсором — ветка не трогается вовсе', async () => {
    const head = '8'.repeat(40);
    const compareMock = jest.fn();
    const { service, syncStateRepository } = buildService({
      state: { last_synced_tip_sha: head },
      github: { listCommitsBetweenBaseAndHead: compareMock },
    });

    await service.syncMarkedCommits({ ...syncArgs('feat/z'), headSha: head });

    expect(compareMock).not.toHaveBeenCalled();
    expect(syncStateRepository.setTipSha).not.toHaveBeenCalled();
  });
});
