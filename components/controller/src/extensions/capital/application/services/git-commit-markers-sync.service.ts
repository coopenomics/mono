import { Injectable, Logger, Inject } from '@nestjs/common';
import { GitHubService } from '../../infrastructure/services/github.service';
import { ISSUE_REPOSITORY, type IssueRepository } from '../../domain/repositories/issue.repository';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
  type IssueLinkedGitCommitRow,
} from '../../domain/repositories/issue-linked-git-commit.repository';
import {
  GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY,
  type GithubBranchCommitSyncStateRepository,
} from '../../domain/repositories/github-branch-commit-sync-state.repository';
import { platformSettings } from '@coopenomics/extension-kit';
import { USER_DIRECTORY_PORT, type IUserDirectoryPort } from '@coopenomics/innercoop';
import { computeGitPatchId } from '../utils/git-patch-id';

type CommitRow = {
  sha: string;
  parents: string[];
  commit: { message: string; author: { date?: string } | null };
};

type SyncContext = {
  coopname: string;
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  githubRepositoryKey: string;
  isDefaultBranch: boolean;
  dryRun: boolean;
  signal?: AbortSignal;
};

/**
 * Синхронизация маркированных non-merge коммитов ветки с задачами (PRD §6, эпик 1.2–1.4).
 * Merge-коммиты (≥2 родителя) пропускаются (FR5).
 *
 * Строка привязки — логический коммит: повторная встреча того же SHA — no-op,
 * а коммит с новым SHA, но той же правкой (rebase/amend/cherry-pick) распознаётся
 * по patch_id и добавляется SHA-алиасом к существующей строке. Поэтому изменение
 * учитывается в РИД ровно один раз, на какой бы ветке оно ни появилось впервые.
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
   * Обработать коммиты на ветке. Базовая ветка при первом запуске индексируется по полной
   * истории до HEAD, прочие ветки — только по коммитам впереди базовой (merge-base);
   * далее все ветки идут инкрементально от сохранённого tip.
   */
  async syncMarkedCommits(args: {
    owner: string;
    repo: string;
    branch: string;
    /** Базовая (каноническая) ветка репозитория — из настройки «Ветка GitHub для синхронизации». */
    defaultBranch: string;
    githubRepositoryKey: string;
    /** Не писать в БД, только отчёт в лог — режим предпросмотра индексации небазовых веток. */
    dryRun?: boolean;
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
    defaultBranch: string;
    githubRepositoryKey: string;
    dryRun?: boolean;
    signal?: AbortSignal;
  }): Promise<void> {
    if (!this.githubService.isAvailable()) {
      return;
    }
    const isDefaultBranch = args.branch === args.defaultBranch;
    const ctx: SyncContext = {
      coopname: platformSettings().coopname,
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
      defaultBranch: args.defaultBranch,
      githubRepositoryKey: args.githubRepositoryKey,
      isDefaultBranch,
      dryRun: !isDefaultBranch && args.dryRun === true,
      signal: args.signal,
    };

    let headSha: string;
    try {
      headSha = await this.githubService.getLatestCommit(ctx.owner, ctx.repo, ctx.branch);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Git маркеры: пропуск синка ${ctx.owner}/${ctx.repo}@${ctx.branch}: ${msg}`);
      return;
    }
    const state = await this.syncStateRepository.getState(ctx.coopname, ctx.githubRepositoryKey, ctx.branch);

    if (!state?.last_synced_tip_sha) {
      await this.runInitialBranchIndexing(ctx, headSha);
      return;
    }
    if (state.last_synced_tip_sha === headSha) {
      return;
    }
    await this.runIncrementalSync(ctx, state.last_synced_tip_sha, headSha);
  }

  private async runInitialBranchIndexing(ctx: SyncContext, headSha: string): Promise<void> {
    if (ctx.isDefaultBranch) {
      this.logger.log(
        `Git маркеры: первичная полная индексация ветки ${ctx.branch}@${ctx.githubRepositoryKey} до HEAD=${headSha}`
      );
      await this.syncFullBranchHistory(ctx, headSha);
      return;
    }
    await this.bootstrapBranchFromDefault(ctx, headSha);
  }

  private async runIncrementalSync(ctx: SyncContext, tipSha: string, headSha: string): Promise<void> {
    let commits: CommitRow[] = [];
    try {
      commits = await this.githubService.listCommitsBetweenBaseAndHead(ctx.owner, ctx.repo, tipSha, headSha);
    } catch (error: unknown) {
      await this.handleCompareFailure(ctx, tipSha, headSha, error);
      return;
    }

    const processed = await this.ingestCommitList(ctx, commits);
    await this.finishBranchPass(ctx, headSha, commits.length, processed);
  }

  /**
   * Старый tip недостижим (force-push с GC): небазовая ветка переиндексируется от базовой,
   * у базовой курсор сбрасывается на текущий HEAD.
   */
  private async handleCompareFailure(ctx: SyncContext, tipSha: string, headSha: string, error: unknown): Promise<void> {
    const msg = error instanceof Error ? error.message : String(error);
    if (!ctx.isDefaultBranch) {
      this.logger.warn(
        `Git маркеры: compare ${tipSha}…${headSha} на ${ctx.branch} не удалось (${msg}) — переиндексация от ${ctx.defaultBranch}`
      );
      await this.bootstrapBranchFromDefault(ctx, headSha);
      return;
    }
    this.logger.warn(`Git маркеры: compare ${tipSha}…${headSha} не удалось (${msg}) — сбрасываем курсор на текущий HEAD`);
    await this.syncStateRepository.setTipSha(ctx.coopname, ctx.githubRepositoryKey, ctx.branch, headSha);
  }

  /**
   * Первичная индексация небазовой ветки: только коммиты впереди базовой ветки
   * (GitHub compare идёт от merge-base) — без выкачивания всей истории репозитория.
   */
  private async bootstrapBranchFromDefault(ctx: SyncContext, headSha: string): Promise<void> {
    let commits: CommitRow[] = [];
    try {
      commits = await this.githubService.listCommitsBetweenBaseAndHead(ctx.owner, ctx.repo, ctx.defaultBranch, headSha);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Git маркеры: bootstrap ветки ${ctx.branch} от ${ctx.defaultBranch} не удался (${msg}) — пропуск`);
      return;
    }

    const processed = await this.ingestCommitList(ctx, commits);
    await this.finishBranchPass(ctx, headSha, commits.length, processed);
  }

  private async ingestCommitList(ctx: SyncContext, commits: CommitRow[]): Promise<number> {
    let processed = 0;
    for (const c of commits) {
      if (ctx.signal?.aborted) {
        const err = new Error('Синхронизация Git прервана');
        err.name = 'AbortError';
        throw err;
      }
      const did = await this.ingestSingleCommitIfMarked(ctx, c);
      if (did) {
        processed += 1;
      }
    }
    return processed;
  }

  private async finishBranchPass(ctx: SyncContext, headSha: string, total: number, processed: number): Promise<void> {
    if (!ctx.dryRun) {
      await this.syncStateRepository.setTipSha(ctx.coopname, ctx.githubRepositoryKey, ctx.branch, headSha);
    }
    if (total > 0 || !ctx.dryRun) {
      this.logger.log(
        `Git маркеры${ctx.dryRun ? ' [dry-run]' : ''}: обработано ${total} коммитов ${ctx.branch} (с маркерами: ${processed}), tip ${
          ctx.dryRun ? 'не сдвинут' : `обновлён до ${headSha}`
        }`
      );
    }
  }

  /** @returns true если коммит имел маркеры и был учтён (новая строка, алиас переписывания или dry-run-отчёт). */
  private async ingestSingleCommitIfMarked(ctx: SyncContext, c: CommitRow): Promise<boolean> {
    if (c.parents.length >= 2) {
      this.logger.debug(`Git маркеры: пропуск merge-коммита ${c.sha}`);
      return false;
    }

    const htmlUrl = `https://github.com/${ctx.owner}/${ctx.repo}/commit/${c.sha}`;

    const known = await this.linkedCommitRepository.findByAnySha(ctx.coopname, c.sha);
    if (known) {
      await this.promoteIfReachedDefaultBranch(ctx, known, c.sha, htmlUrl);
      return false;
    }

    const target = await this.resolveMarkedTarget(ctx.coopname, c);
    if (!target) {
      return false;
    }

    const diffText = await this.loadCommitPatch(ctx, c.sha);
    if (diffText === null) {
      return false;
    }

    return this.persistMarkedCommit(ctx, c, target, htmlUrl, diffText);
  }

  /** Записать маркированный коммит: SHA-алиасом к переписанному оригиналу либо новой строкой. */
  private async persistMarkedCommit(
    ctx: SyncContext,
    c: CommitRow,
    target: { issueHash: string; projectHash: string; username: string },
    htmlUrl: string,
    diffText: string
  ): Promise<boolean> {
    // Дифф без строк правок (пустой коммит, только бинарные файлы) не имеет содержательной
    // идентичности — фолбэк на SHA, чтобы такие коммиты не склеивались между собой.
    const patchId = computeGitPatchId(diffText) ?? c.sha;

    const rewrite = await this.linkedCommitRepository.findByPatchIdentity({
      coopname: ctx.coopname,
      githubOwner: ctx.owner,
      githubRepo: ctx.repo,
      issueHash: target.issueHash,
      patchId,
    });
    if (rewrite) {
      await this.linkRewriteAsAlias(ctx, rewrite, c.sha, htmlUrl, target.issueHash);
      return true;
    }

    if (ctx.dryRun) {
      this.logger.log(
        `Git маркеры [dry-run]: ${c.sha} на ${ctx.branch} — новая привязка к задаче ${target.issueHash} (@${target.username}): ${(c.commit.message || '').split('\n')[0].slice(0, 120)}`
      );
      return true;
    }

    await this.linkedCommitRepository.insertLinkedCommit({
      coopname: ctx.coopname,
      github_owner: ctx.owner,
      github_repo: ctx.repo,
      github_sha: c.sha,
      html_url: htmlUrl,
      issue_hash: target.issueHash,
      project_hash: target.projectHash,
      username: target.username,
      commit_message: c.commit.message || '',
      git_author_login: null,
      git_author_email: null,
      committed_at: c.commit.author?.date ? new Date(c.commit.author.date) : new Date(),
      diff_text: diffText || '',
      patch_id: patchId,
      first_seen_branch: ctx.branch,
      in_default_branch: ctx.isDefaultBranch,
    });
    return true;
  }

  private async promoteIfReachedDefaultBranch(
    ctx: SyncContext,
    known: IssueLinkedGitCommitRow,
    sha: string,
    htmlUrl: string
  ): Promise<void> {
    if (!ctx.isDefaultBranch || known.in_default_branch) {
      return;
    }
    await this.linkedCommitRepository.promoteToDefaultBranch({
      linkedCommitId: known.id,
      canonicalSha: sha,
      canonicalHtmlUrl: htmlUrl,
    });
    this.logger.log(`Git маркеры: коммит ${sha} дошёл до ${ctx.branch} — привязка помечена канонической`);
  }

  private async linkRewriteAsAlias(
    ctx: SyncContext,
    rewrite: IssueLinkedGitCommitRow,
    sha: string,
    htmlUrl: string,
    issueHash: string
  ): Promise<void> {
    if (ctx.dryRun) {
      this.logger.log(
        `Git маркеры [dry-run]: ${sha} на ${ctx.branch} — переписывание уже учтённого ${rewrite.github_sha} (задача ${issueHash}), добавился бы SHA-алиас`
      );
      return;
    }
    await this.linkedCommitRepository.registerShaAlias({
      linkedCommitId: rewrite.id,
      coopname: ctx.coopname,
      githubSha: sha,
      seenBranch: ctx.branch,
    });
    if (ctx.isDefaultBranch && !rewrite.in_default_branch) {
      await this.linkedCommitRepository.promoteToDefaultBranch({
        linkedCommitId: rewrite.id,
        canonicalSha: sha,
        canonicalHtmlUrl: htmlUrl,
      });
    }
    this.logger.log(
      `Git маркеры: ${sha} на ${ctx.branch} — переписывание уже учтённого ${rewrite.github_sha}, добавлен SHA-алиас (в РИД не задваивается)`
    );
  }

  /** Разобрать маркеры и найти задачу с проектом и пользователя; при любой нехватке — warn и null. */
  private async resolveMarkedTarget(
    coopname: string,
    c: CommitRow
  ): Promise<{ issueHash: string; projectHash: string; username: string } | null> {
    const parsed = this.parseMarkers(c.commit.message || '');
    if (!parsed) {
      return null;
    }

    const issue = await this.findIssueByMarker(coopname, parsed);
    if (!issue) {
      this.logger.warn(
        `Git маркеры: коммит ${c.sha} — задача не найдена (маркер задачи: ${parsed.issueHash ?? parsed.clientId ?? '?'})`
      );
      return null;
    }

    const projectHash = issue.project_hash?.trim();
    if (!projectHash) {
      this.logger.warn(
        `Git маркеры: коммит ${c.sha} — у задачи ${issue.issue_hash} нет проекта (свободная задача), привязку пропускаем`
      );
      return null;
    }

    const user =
      (await this.userRepository.findByUsername(parsed.username)) ||
      (await this.userRepository.findByUsername(parsed.username.toLowerCase()));
    if (!user) {
      this.logger.warn(`Git маркеры: коммит ${c.sha} — пользователь @${parsed.username} не найден в кооперативе`);
      return null;
    }

    return { issueHash: issue.issue_hash, projectHash, username: user.username };
  }

  private async findIssueByMarker(
    coopname: string,
    parsed: { issueHash?: string; clientId?: string }
  ): Promise<{ issue_hash: string; project_hash?: string | null } | null> {
    if (parsed.issueHash != null) {
      return this.issueRepository.findByIssueHash(parsed.issueHash);
    }
    if (parsed.clientId != null) {
      return this.issueRepository.findByCoopnameAndClientId(coopname, parsed.clientId);
    }
    return null;
  }

  private async loadCommitPatch(ctx: SyncContext, sha: string): Promise<string | null> {
    try {
      return await this.githubService.getCommitPatchesConcat(ctx.owner, ctx.repo, sha);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Git маркеры: не удалось загрузить patch для ${sha}: ${msg}`);
      return null;
    }
  }

  private async syncFullBranchHistory(ctx: SyncContext, headSha: string): Promise<void> {
    const commits = await this.githubService.listAllCommitsOnBranchOldestFirst(
      ctx.owner,
      ctx.repo,
      ctx.branch,
      ctx.signal
    );
    this.logger.log(`Git маркеры: загружено ${commits.length} коммитов ветки для полной индексации`);

    const processed = await this.ingestCommitList(ctx, commits);

    await this.syncStateRepository.setTipSha(ctx.coopname, ctx.githubRepositoryKey, ctx.branch, headSha);
    this.logger.log(
      `Git маркеры: полная индексация завершена (${commits.length} коммитов ветки, с маркерами и patch: ${processed}), tip=${headSha}`
    );
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
