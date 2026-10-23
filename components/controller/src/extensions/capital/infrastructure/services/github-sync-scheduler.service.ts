import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common'
import { GitCommitMarkersSyncService } from '../../application/services/git-commit-markers-sync.service'
import {
  normalizeDevelopmentRepositoryUrl,
  parseGitHubDevelopmentRepository,
} from '../../application/utils/parse-github-development-repository-url'
import * as cron from 'node-cron'
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository'
import {
  GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY,
  type GithubBranchCommitSyncStateRepository,
} from '../../domain/repositories/github-branch-commit-sync-state.repository'
import { GitHubService } from './github.service'
import { platformSettings } from '@coopenomics/extension-kit';

type TickOptions = {
  baseBranch: string
  syncAllBranches: boolean
  branchFilter: string
}

type RepositoryKey = { owner: string; repo: string; key: string }

type RepositoryTickPlan = {
  baseBranch: string
  branches: string[]
  headShaByBranch: Map<string, string>
}

/**
 * Планировщик опроса GitHub по URL репозиториев проектов/компонентов (PRD §6.2.1, эпик 6).
 * Legacy markdown-синхронизация проектов/результатов с GitHub удалена.
 */
@Injectable()
export class GitHubSyncSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(GitHubSyncSchedulerService.name)
  private cronJob: cron.ScheduledTask | null = null
  /** Базовая ветка, выбранная для репозитория в прошлый тик, — чтобы не писать в лог одно и то же каждую минуту. */
  private readonly announcedBaseBranchByKey = new Map<string, string>()

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY)
    private readonly syncStateRepository: GithubBranchCommitSyncStateRepository,
    private readonly gitCommitMarkersSyncService: GitCommitMarkersSyncService,
    private readonly githubService: GitHubService
  ) {}

  /**
   * Включить периодический опрос маркеров коммитов по всем непустым URL из БД и ветке из конфига Capital.
   * При `syncAllBranches` базовая ветка синкается первой (её SHA становятся каноническими),
   * затем остальные ветки репозитория, отфильтрованные `branchFilter`.
   */
  async startFromExtensionConfig(args: {
    githubSyncBranch: string
    pollIntervalMinutes: number
    syncAllBranches?: boolean
    branchFilter?: string
  }): Promise<void> {
    await this.stop()

    const poll = Number(args.pollIntervalMinutes)
    if (!Number.isFinite(poll) || poll <= 0) {
      this.logger.log('Планировщик маркеров Git-коммитов не запущен: интервал опроса 0 или отключён (github_sync_poll_interval_minutes)')
      return
    }

    if (!this.githubService.isAvailable()) {
      this.logger.warn(
        'Опрос маркеров GitHub не включён: нет токена (конфиг Capital «Токен GitHub API» или переменная GITHUB_TOKEN)'
      )
      return
    }

    const options = this.buildTickOptions(args)
    const interval = Math.min(60, Math.max(1, Math.floor(poll)))
    const cronExpression = `*/${interval} * * * *`
    this.logInitConfiguration(options, cronExpression)

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.runTick(options)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const trace = error instanceof Error ? error.stack : undefined
        this.logger.error(`Ошибка в задаче опроса маркеров Git по расписанию: ${message}`, trace)
      }
    })

    try {
      await this.runTick(options)
    } catch (error: unknown) {
      this.logger.warn(
        'Первичный опрос маркеров Git не удался, будет повторен по расписанию',
        error instanceof Error ? error.stack : String(error)
      )
    }

    this.logger.log('Планировщик маркеров Git-коммитов инициализирован')
  }

  private buildTickOptions(args: {
    githubSyncBranch: string
    syncAllBranches?: boolean
    branchFilter?: string
  }): TickOptions {
    return {
      baseBranch: (args.githubSyncBranch || 'dev').trim() || 'dev',
      syncAllBranches: args.syncAllBranches !== false,
      branchFilter: (args.branchFilter || '*').trim() || '*',
    }
  }

  private logInitConfiguration(options: TickOptions, cronExpression: string): void {
    this.logger.log(
      `Инициализация планировщика маркеров Git-коммитов (cron: ${cronExpression}, базовая ветка ${options.baseBranch}` +
        (options.syncAllBranches ? `, все ветки по фильтру «${options.branchFilter}»)` : ')')
    )
  }

  private async runTick(options: TickOptions): Promise<void> {
    const coopname = platformSettings().coopname
    const repositoryKeys = await this.collectRepositoryKeys(coopname)
    if (repositoryKeys.length === 0) {
      this.logger.debug('Маркеры Git: нет проектов с заданным URL репозитория — тик пропущен')
      return
    }

    for (const repositoryKey of repositoryKeys) {
      const plan = await this.buildRepositoryTickPlan(repositoryKey, options)
      if (!plan) {
        continue
      }
      for (const branch of plan.branches) {
        try {
          await this.gitCommitMarkersSyncService.syncMarkedCommits({
            owner: repositoryKey.owner,
            repo: repositoryKey.repo,
            branch,
            defaultBranch: plan.baseBranch,
            githubRepositoryKey: repositoryKey.key,
            headSha: plan.headShaByBranch.get(branch),
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          const trace = error instanceof Error ? error.stack : undefined
          this.logger.error(`Ошибка синхронизации маркеров для ${repositoryKey.key}@${branch}: ${message}`, trace)
        }
      }
      if (options.syncAllBranches && plan.branches.length > 1) {
        await this.cleanupStaleBranchCursors(coopname, repositoryKey.key, plan.branches)
      }
    }
  }

  private async collectRepositoryKeys(coopname: string): Promise<RepositoryKey[]> {
    const rawUrls = await this.projectRepository.findDistinctDevelopmentRepositoryUrls(coopname)
    const normalizedKeys = new Map<string, RepositoryKey>()
    for (const raw of rawUrls) {
      const key = normalizeDevelopmentRepositoryUrl(raw)
      const parsed = key ? parseGitHubDevelopmentRepository(key) : null
      if (key && parsed) {
        normalizedKeys.set(key, { owner: parsed.owner, repo: parsed.repo, key })
      } else {
        this.logger.warn(`Пропуск URL репозитория (не github.com / owner:repo): ${raw}`)
      }
    }
    return [...normalizedKeys.values()]
  }

  /**
   * План опроса репозитория за один тик: базовая ветка (настроенная либо ветка репозитория
   * по умолчанию), список веток к обходу и их HEAD-SHA из того же листинга.
   * Базовая ветка идёт первой: её SHA должны стать каноническими раньше фичевых воплощений.
   * @returns null, если репозиторий в этот тик синхронизировать нечем.
   */
  private async buildRepositoryTickPlan(
    repositoryKey: RepositoryKey,
    options: TickOptions
  ): Promise<RepositoryTickPlan | null> {
    let heads: { name: string; sha: string }[]
    try {
      heads = await this.githubService.listBranchHeads(repositoryKey.owner, repositoryKey.repo)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Маркеры Git: не удалось получить список веток ${repositoryKey.key} (${message}) — тик только по ${options.baseBranch}`
      )
      return { baseBranch: options.baseBranch, branches: [options.baseBranch], headShaByBranch: new Map() }
    }

    const baseBranch = await this.resolveBaseBranch(repositoryKey, options.baseBranch, heads)
    if (!baseBranch) {
      return null
    }

    const headShaByBranch = new Map(heads.map((h) => [h.name, h.sha]))
    const branches = options.syncAllBranches
      ? [
          baseBranch,
          ...heads
            .map((h) => h.name)
            .filter((b) => b !== baseBranch && this.branchMatchesFilter(b, options.branchFilter)),
        ]
      : [baseBranch]
    return { baseBranch, branches, headShaByBranch }
  }

  /**
   * Настройка «Ветка GitHub для синхронизации» одна на кооператив, а репозитории проектов живут
   * с разными канонами (`dev` у mono, `main` у отдельных продуктов). Если настроенной ветки в
   * репозитории нет — обходим его ветку по умолчанию, иначе он не синхронизировался бы вовсе.
   */
  private async resolveBaseBranch(
    repositoryKey: RepositoryKey,
    configuredBranch: string,
    heads: { name: string; sha: string }[]
  ): Promise<string | null> {
    let resolved: string | null
    try {
      resolved = await this.githubService.resolveExistingBaseBranch(
        repositoryKey.owner,
        repositoryKey.repo,
        configuredBranch,
        heads.map((h) => h.name)
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Маркеры Git: не удалось определить базовую ветку ${repositoryKey.key} (${message}) — тик пропущен`)
      return null
    }

    if (!resolved) {
      if (this.announceBaseBranch(repositoryKey.key, '')) {
        this.logger.warn(
          `Маркеры Git: в ${repositoryKey.key} нет ни ветки «${configuredBranch}», ни доступной ветки по умолчанию — репозиторий не опрашивается`
        )
      }
      return null
    }
    const changed = this.announceBaseBranch(repositoryKey.key, resolved)
    if (changed && resolved !== configuredBranch) {
      this.logger.log(
        `Маркеры Git: в ${repositoryKey.key} нет ветки «${configuredBranch}» — обходим ветку репозитория по умолчанию «${resolved}»`
      )
    }
    return resolved
  }

  /** @returns true, если для этого репозитория выбор базовой ветки ещё не логировался. */
  private announceBaseBranch(repositoryKey: string, branch: string): boolean {
    if (this.announcedBaseBranchByKey.get(repositoryKey) === branch) {
      return false
    }
    this.announcedBaseBranchByKey.set(repositoryKey, branch)
    return true
  }

  private async cleanupStaleBranchCursors(coopname: string, repositoryKey: string, branches: string[]): Promise<void> {
    try {
      const tracked = await this.syncStateRepository.listBranches(coopname, repositoryKey)
      for (const trackedBranch of tracked) {
        if (!branches.includes(trackedBranch)) {
          await this.syncStateRepository.deleteState(coopname, repositoryKey, trackedBranch)
          this.logger.log(
            `Маркеры Git: ветка ${trackedBranch} удалена в ${repositoryKey} — курсор снят (привязки коммитов сохранены)`
          )
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Маркеры Git: чистка курсоров ${repositoryKey} не удалась: ${message}`)
    }
  }

  /** Фильтр веток: glob-шаблоны через запятую, `*` — любая подстрока (например `feat/*,fix/*`). */
  private branchMatchesFilter(branch: string, filter: string): boolean {
    const patterns = filter
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (patterns.length === 0) {
      return true
    }
    return patterns.some((pattern) => {
      const regex = new RegExp(
        '^' +
          pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$'
      )
      return regex.test(branch)
    })
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      this.logger.log('Планировщик маркеров Git-коммитов остановлен')
    }
  }

  onModuleDestroy(): void {
    void this.stop()
  }
}
