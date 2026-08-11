import { Injectable, Logger, Inject } from '@nestjs/common';
import { GitHubService } from '../../infrastructure/services/github.service';
import { ISSUE_REPOSITORY, type IssueRepository } from '../../domain/repositories/issue.repository';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
} from '../../domain/repositories/issue-linked-git-commit.repository';
import {
  GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY,
  type GithubBranchCommitSyncStateRepository,
} from '../../domain/repositories/github-branch-commit-sync-state.repository';
import { platformSettings } from '@coopenomics/extension-kit';
import { USER_DIRECTORY_PORT, type IUserDirectoryPort } from '@coopenomics/innercoop';

type CommitRow = {
  sha: string;
  parents: string[];
  commit: { message: string; author: { date?: string } | null };
};

/**
 * Синхронизация маркированных non-merge коммитов ветки с задачами (PRD §6, эпик 1.2–1.4).
 * Merge-коммиты (≥2 родителя) пропускаются (FR5).
 */
@Injectable()
export class GitCommitMarkersSyncService {
  private readonly logger = new Logger(GitCommitMarkersSyncService.name);
  /** Последовательное выполнение синка по паре «репозиторий + ветка» (cron + немедленный вызов). */
  private readonly syncPipelineByKey = new Map<string, Promise<void>>();

  constructor(
    private readonly githubService: GitHubService,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(ISSUE_LINKED_GIT_COMMIT_REPOSITORY)
    private readonly linkedCommitRepository: IssueLinkedGitCommitRepository,
    @Inject(GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY)
    private readonly syncStateRepository: GithubBranchCommitSyncStateRepository,
    @Inject(USER_DIRECTORY_PORT)
    private readonly userRepository: IUserDirectoryPort
  ) {}

  /**
   * Обработать коммиты на ветке: при первом запуске по ключу репозитория — полная история ветки до HEAD,
   * далее — инкрементально от сохранённого tip.
   */
  async syncMarkedCommits(args: {
    owner: string;
    repo: string;
    branch: string;
    githubRepositoryKey: string;
    signal?: AbortSignal;
  }): Promise<void> {
    const queueKey = `${args.githubRepositoryKey}@${args.branch}`;
    const previous = this.syncPipelineByKey.get(queueKey);
    const afterPrevious = previous ? previous.catch(() => undefined) : Promise.resolve();
    const work = afterPrevious.then(() => this.executeSyncMarkedCommits(args));
    this.syncPipelineByKey.set(queueKey, work);
    try {
      await work;
    } finally {
      if (this.syncPipelineByKey.get(queueKey) === work) {
        this.syncPipelineByKey.delete(queueKey);
      }
    }
  }

  private async executeSyncMarkedCommits(args: {
    owner: string;
    repo: string;
    branch: string;
    githubRepositoryKey: string;
    signal?: AbortSignal;
  }): Promise<void> {
    const { owner, repo, branch, githubRepositoryKey, signal } = args;
    const coopname = platformSettings().coopname;

    if (!this.githubService.isAvailable()) {
      return;
    }

    let headSha: string;
    try {
      headSha = await this.githubService.getLatestCommit(owner, repo, branch);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Git маркеры: пропуск синка ${owner}/${repo}@${branch}: ${msg}`);
      return;
    }
    const state = await this.syncStateRepository.getState(coopname, githubRepositoryKey, branch);

    if (!state?.last_synced_tip_sha) {
      this.logger.log(
        `Git маркеры: первичная полная индексация ветки ${branch}@${githubRepositoryKey} до HEAD=${headSha}`
      );
      await this.syncFullBranchHistory({
        coopname,
        owner,
        repo,
        branch,
        githubRepositoryKey,
        headSha,
        signal,
      });
      return;
    }

    if (state.last_synced_tip_sha === headSha) {
      return;
    }

    let commits: CommitRow[] = [];
    try {
      commits = await this.githubService.listCommitsBetweenBaseAndHead(
        owner,
        repo,
        state.last_synced_tip_sha,
        headSha
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Git маркеры: compare ${state.last_synced_tip_sha}…${headSha} не удалось (${msg}) — сбрасываем курсор на текущий HEAD`
      );
      await this.syncStateRepository.setTipSha(coopname, githubRepositoryKey, branch, headSha);
      return;
    }

    for (const c of commits) {
      if (signal?.aborted) {
        const err = new Error('Синхронизация Git прервана');
        err.name = 'AbortError';
        throw err;
      }
      await this.ingestSingleCommitIfMarked({ coopname, owner, repo, c });
    }

    await this.syncStateRepository.setTipSha(coopname, githubRepositoryKey, branch, headSha);
    this.logger.log(`Git маркеры: обработано ${commits.length} коммитов между SHAs, tip обновлён до ${headSha}`);
  }

  private async syncFullBranchHistory(args: {
    coopname: string;
    owner: string;
    repo: string;
    branch: string;
    githubRepositoryKey: string;
    headSha: string;
    signal?: AbortSignal;
  }): Promise<void> {
    const { coopname, owner, repo, branch, githubRepositoryKey, headSha, signal } = args;

    const commits = await this.githubService.listAllCommitsOnBranchOldestFirst(owner, repo, branch, signal);
    this.logger.log(`Git маркеры: загружено ${commits.length} коммитов ветки для полной индексации`);

    let processed = 0;
    for (const c of commits) {
      if (signal?.aborted) {
        const err = new Error('Синхронизация Git прервана');
        err.name = 'AbortError';
        throw err;
      }
      const did = await this.ingestSingleCommitIfMarked({ coopname, owner, repo, c });
      if (did) {
        processed += 1;
      }
    }

    await this.syncStateRepository.setTipSha(coopname, githubRepositoryKey, branch, headSha);
    this.logger.log(
      `Git маркеры: полная индексация завершена (${commits.length} коммитов ветки, с маркерами и patch: ${processed}), tip=${headSha}`
    );
  }

  /** @returns true если коммит имел маркеры и был сохранён (или уже существовал). */
  private async ingestSingleCommitIfMarked(args: {
    coopname: string;
    owner: string;
    repo: string;
    c: CommitRow;
  }): Promise<boolean> {
    const { coopname, owner, repo, c } = args;

    if (c.parents.length >= 2) {
      this.logger.debug(`Git маркеры: пропуск merge-коммита ${c.sha}`);
      return false;
    }

    const parsed = this.parseMarkers(c.commit.message || '');
    if (!parsed) {
      return false;
    }

    const issue =
      parsed.issueHash != null
        ? await this.issueRepository.findByIssueHash(parsed.issueHash)
        : parsed.clientId != null
          ? await this.issueRepository.findByCoopnameAndClientId(coopname, parsed.clientId)
          : null;

    if (!issue) {
      this.logger.warn(
        `Git маркеры: коммит ${c.sha} — задача не найдена (маркер задачи: ${parsed.issueHash ?? parsed.clientId ?? '?'})`
      );
      return false;
    }

    const projectHash = issue.project_hash?.trim();
    if (!projectHash) {
      this.logger.warn(
        `Git маркеры: коммит ${c.sha} — у задачи ${issue.issue_hash} нет проекта (свободная задача), привязку пропускаем`
      );
      return false;
    }

    const user =
      (await this.userRepository.findByUsername(parsed.username)) ||
      (await this.userRepository.findByUsername(parsed.username.toLowerCase()));
    if (!user) {
      this.logger.warn(`Git маркеры: коммит ${c.sha} — пользователь @${parsed.username} не найден в кооперативе`);
      return false;
    }

    let diffText = '';
    try {
      diffText = await this.githubService.getCommitPatchesConcat(owner, repo, c.sha);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Git маркеры: не удалось загрузить patch для ${c.sha}: ${msg}`);
      return false;
    }

    const committedAt = c.commit.author?.date ? new Date(c.commit.author.date) : new Date();
    const htmlUrl = `https://github.com/${owner}/${repo}/commit/${c.sha}`;

    await this.linkedCommitRepository.upsertIgnoreDuplicate({
      coopname,
      github_owner: owner,
      github_repo: repo,
      github_sha: c.sha,
      html_url: htmlUrl,
      issue_hash: issue.issue_hash,
      project_hash: projectHash,
      username: user.username,
      commit_message: c.commit.message || '',
      git_author_login: null,
      git_author_email: null,
      committed_at: committedAt,
      diff_text: diffText || '',
    });
    return true;
  }

  private parseMarkers(message: string): { username: string; issueHash?: string; clientId?: string } | null {
    const userMatch = message.match(/\[@([a-zA-Z0-9]{1,12})\]/);
    if (!userMatch) {
      return null;
    }
    const username = userMatch[1];

    const hashMatch = message.match(/\[(?!@)([a-fA-F0-9]{64})\]/);
    if (hashMatch) {
      return { username, issueHash: hashMatch[1].toLowerCase() };
    }

    const clientMatch = message.match(/\[(?!@)([A-Za-z0-9]+-\d{1,6})\]/);
    if (clientMatch) {
      return { username, clientId: clientMatch[1] };
    }

    this.logger.debug('Git маркеры: сообщение без маркера задачи (ожидается [hash] или [PREFIX-NN])');
    return null;
  }
}
