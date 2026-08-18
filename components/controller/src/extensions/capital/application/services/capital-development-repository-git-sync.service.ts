import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { GitCommitMarkersSyncService } from './git-commit-markers-sync.service';
import {
  GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY,
  type GithubBranchCommitSyncStateRepository,
} from '../../domain/repositories/github-branch-commit-sync-state.repository';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { GitHubService } from '../../infrastructure/services/github.service';
import { parseGitHubDevelopmentRepository } from '../utils/parse-github-development-repository-url';

/**
 * Жизненный цикл мониторинга Git по URL репозитория проекта: немедленный синк при сохранении,
 * отмена фоновой индексации и очистка курсора при снятии URL (если репозиторий больше ни у кого не привязан).
 */
@Injectable()
export class CapitalDevelopmentRepositoryGitSyncService {
  private readonly logger = new Logger(CapitalDevelopmentRepositoryGitSyncService.name);
  private readonly syncAbortByRepositoryKey = new Map<string, AbortController>();

  constructor(
    @Inject(EXTENSION_REPOSITORY)
    private readonly extensionRepository: ExtensionDomainRepository<Record<string, unknown>>,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY)
    private readonly githubBranchCommitSyncStateRepository: GithubBranchCommitSyncStateRepository,
    private readonly gitCommitMarkersSyncService: GitCommitMarkersSyncService,
    private readonly githubService: GitHubService
  ) {}

  private abortInFlightForRepositoryKey(repositoryKey: string): void {
    const prev = this.syncAbortByRepositoryKey.get(repositoryKey);
    if (prev) {
      prev.abort();
      this.syncAbortByRepositoryKey.delete(repositoryKey);
    }
  }

  private clearAbortRegistration(repositoryKey: string, ac: AbortController): void {
    const cur = this.syncAbortByRepositoryKey.get(repositoryKey);
    if (cur === ac) {
      this.syncAbortByRepositoryKey.delete(repositoryKey);
    }
  }

  private async resolveGithubSyncBranch(): Promise<string> {
    const row = await this.extensionRepository.findByName('capital');
    const cfg = row?.config as Record<string, unknown> | undefined;
    const b = typeof cfg?.github_sync_branch === 'string' ? cfg.github_sync_branch.trim() : '';
    return b || 'dev';
  }

  /**
   * После изменения URL в проекте: снять курсор с «осиротевшего» репозитория и запустить полный/инкрементальный синк для нового ключа.
   * Не блокирует HTTP: вызывать через void …catch.
   */
  async runAfterDevelopmentRepositoryUrlChange(args: {
    coopname: string;
    previousNormalizedKey: string | null;
    nextNormalizedKey: string | null;
  }): Promise<void> {
    const branch = await this.resolveGithubSyncBranch();

    if (args.previousNormalizedKey && args.previousNormalizedKey !== args.nextNormalizedKey) {
      this.abortInFlightForRepositoryKey(args.previousNormalizedKey);
      const remaining = await this.projectRepository.countByCoopnameAndDevelopmentRepositoryUrl(
        args.coopname,
        args.previousNormalizedKey
      );
      if (remaining === 0) {
        await this.githubBranchCommitSyncStateRepository.deleteState(args.coopname, args.previousNormalizedKey, branch);
        this.logger.log(
          `Git маркеры: курсор снят для ${args.previousNormalizedKey}@${branch} (репозиторий больше не привязан к проектам)`
        );
      }
    }

    if (!args.nextNormalizedKey) {
      return;
    }

    if (!this.githubService.isAvailable()) {
      this.logger.warn('Git маркеры: немедленный синк пропущен — нет токена GitHub API');
      return;
    }

    const parsed = parseGitHubDevelopmentRepository(args.nextNormalizedKey);
    if (!parsed) {
      this.logger.warn(`Git маркеры: не удалось разобрать ключ репозитория: ${args.nextNormalizedKey}`);
      return;
    }

    const ac = new AbortController();
    this.abortInFlightForRepositoryKey(args.nextNormalizedKey);
    this.syncAbortByRepositoryKey.set(args.nextNormalizedKey, ac);
    const signal = ac.signal;

    try {
      await this.gitCommitMarkersSyncService.syncMarkedCommits({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        githubRepositoryKey: args.nextNormalizedKey,
        signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.log(`Git маркеры: синк для ${args.nextNormalizedKey} прерван`);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const trace = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Git маркеры: ошибка немедленного синка ${args.nextNormalizedKey}: ${message}`, trace);
    } finally {
      this.clearAbortRegistration(args.nextNormalizedKey, ac);
    }
  }

  /** Остановить все фоновые индексации (например, при остановке расширения Capital). */
  abortAllInFlightRepositorySyncs(): void {
    for (const [, ac] of this.syncAbortByRepositoryKey) {
      ac.abort();
    }
    this.syncAbortByRepositoryKey.clear();
    this.logger.log('Git маркеры: остановлены все текущие фоновые индексации по репозиториям');
  }
}
