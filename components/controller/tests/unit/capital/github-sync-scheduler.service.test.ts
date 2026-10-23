import { GitHubSyncSchedulerService } from '../../../src/extensions/capital/infrastructure/services/github-sync-scheduler.service';
import { GitHubService } from '../../../src/extensions/capital/infrastructure/services/github.service';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

const CARDCOOP = 'https://github.com/coopenomics/cardcoop';

function buildGithubService() {
  const secretCipher = { decrypt: jest.fn(), encrypt: jest.fn() };
  const integrations = { get: jest.fn().mockReturnValue({ token: 'token' }) };
  return new GitHubService(secretCipher as never, integrations as never);
}

function buildScheduler(overrides: {
  urls?: string[];
  github?: Partial<Record<string, jest.Mock>>;
}) {
  const githubService = {
    isAvailable: jest.fn().mockReturnValue(true),
    listBranchHeads: jest.fn().mockResolvedValue([
      { name: 'main', sha: 'a'.repeat(40) },
      { name: 'legacy', sha: 'b'.repeat(40) },
    ]),
    resolveExistingBaseBranch: jest.fn().mockResolvedValue('main'),
    getLatestCommit: jest.fn().mockResolvedValue('c'.repeat(40)),
    ...overrides.github,
  };
  const projectRepository = {
    findDistinctDevelopmentRepositoryUrls: jest.fn().mockResolvedValue(overrides.urls ?? [CARDCOOP]),
  };
  const syncStateRepository = {
    listBranches: jest.fn().mockResolvedValue([]),
    deleteState: jest.fn().mockResolvedValue(undefined),
  };
  const gitCommitMarkersSyncService = {
    syncMarkedCommits: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = new GitHubSyncSchedulerService(
    projectRepository as never,
    syncStateRepository as never,
    gitCommitMarkersSyncService as never,
    githubService as never
  );
  return { scheduler, githubService, gitCommitMarkersSyncService };
}

const startArgs = {
  githubSyncBranch: 'dev',
  pollIntervalMinutes: 5,
  syncAllBranches: true,
  branchFilter: '*',
};

describe('GitHubSyncSchedulerService — стоимость тика и базовая ветка репозитория', () => {
  it('HEAD веток берётся из листинга, отдельный запрос на ветку не делается', async () => {
    const { scheduler, githubService, gitCommitMarkersSyncService } = buildScheduler({});

    await scheduler.startFromExtensionConfig(startArgs);
    await scheduler.stop();

    expect(githubService.getLatestCommit).not.toHaveBeenCalled();
    expect(githubService.listBranchHeads).toHaveBeenCalledTimes(1);
    const shaByBranch = new Map(
      gitCommitMarkersSyncService.syncMarkedCommits.mock.calls.map((c) => [c[0].branch, c[0].headSha])
    );
    expect(shaByBranch.get('main')).toBe('a'.repeat(40));
    expect(shaByBranch.get('legacy')).toBe('b'.repeat(40));
  });

  it('репозиторий без настроенной ветки обходится по своей ветке по умолчанию', async () => {
    const { scheduler, gitCommitMarkersSyncService } = buildScheduler({});

    await scheduler.startFromExtensionConfig(startArgs);
    await scheduler.stop();

    const calls = gitCommitMarkersSyncService.syncMarkedCommits.mock.calls.map((c) => c[0]);
    expect(calls.every((c) => c.defaultBranch === 'main')).toBe(true);
    expect(calls[0].branch).toBe('main');
    expect(calls.map((c) => c.branch)).toEqual(['main', 'legacy']);
  });

  it('репозиторий, где нет ни настроенной ветки, ни ветки по умолчанию, пропускается', async () => {
    const { scheduler, gitCommitMarkersSyncService } = buildScheduler({
      github: { resolveExistingBaseBranch: jest.fn().mockResolvedValue(null) },
    });

    await scheduler.startFromExtensionConfig(startArgs);
    await scheduler.stop();

    expect(gitCommitMarkersSyncService.syncMarkedCommits).not.toHaveBeenCalled();
  });

  it('если листинг веток не удался, тик идёт по настроенной ветке и запрашивает HEAD сам', async () => {
    const { scheduler, gitCommitMarkersSyncService } = buildScheduler({
      github: { listBranchHeads: jest.fn().mockRejectedValue(new Error('rate limit')) },
    });

    await scheduler.startFromExtensionConfig(startArgs);
    await scheduler.stop();

    expect(gitCommitMarkersSyncService.syncMarkedCommits).toHaveBeenCalledTimes(1);
    const call = gitCommitMarkersSyncService.syncMarkedCommits.mock.calls[0][0];
    expect(call.branch).toBe('dev');
    expect(call.headSha).toBeUndefined();
  });
});

describe('GitHubService.resolveExistingBaseBranch', () => {
  it('настроенная ветка есть — за веткой по умолчанию не ходим', async () => {
    const service = buildGithubService();
    const getDefaultBranch = jest.spyOn(service, 'getDefaultBranch');

    await expect(service.resolveExistingBaseBranch('coopenomics', 'mono', 'dev', ['dev', 'main'])).resolves.toBe('dev');
    expect(getDefaultBranch).not.toHaveBeenCalled();
  });

  it('настроенной ветки нет — берётся ветка репозитория по умолчанию', async () => {
    const service = buildGithubService();
    jest.spyOn(service, 'listBranches').mockResolvedValue(['main', 'legacy']);
    jest.spyOn(service, 'getDefaultBranch').mockResolvedValue('main');

    await expect(service.resolveExistingBaseBranch('coopenomics', 'cardcoop', 'dev')).resolves.toBe('main');
  });

  it('ветки по умолчанию среди доступных нет — null, репозиторий не синкается вслепую', async () => {
    const service = buildGithubService();
    jest.spyOn(service, 'getDefaultBranch').mockResolvedValue('trunk');

    await expect(service.resolveExistingBaseBranch('coopenomics', 'cardcoop', 'dev', ['main'])).resolves.toBeNull();
  });
});
