import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common'
import { GitCommitMarkersSyncService } from '../../application/services/git-commit-markers-sync.service'
import {
  normalizeDevelopmentRepositoryUrl,
  parseGitHubDevelopmentRepository,
} from '../../application/utils/parse-github-development-repository-url'
import * as cron from 'node-cron'
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository'
import { GitHubService } from './github.service'
import { platformSettings } from '@coopenomics/extension-kit';

/**
 * Планировщик опроса GitHub по URL репозиториев проектов/компонентов (PRD §6.2.1, эпик 6).
 * Legacy markdown-синхронизация проектов/результатов с GitHub удалена.
 */
@Injectable()
export class GitHubSyncSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(GitHubSyncSchedulerService.name)
  private cronJob: cron.ScheduledTask | null = null

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    private readonly gitCommitMarkersSyncService: GitCommitMarkersSyncService,
    private readonly githubService: GitHubService
  ) {}

  /**
   * Включить периодический опрос маркеров коммитов по всем непустым URL из БД и ветке из конфига Capital.
   */
  async startFromExtensionConfig(args: { githubSyncBranch: string; pollIntervalMinutes: number }): Promise<void> {
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

    const branch = (args.githubSyncBranch || 'dev').trim() || 'dev'
    const interval = Math.min(60, Math.max(1, Math.floor(poll)))
    const cronExpression = `*/${interval} * * * *`

    this.logger.log(`Инициализация планировщика маркеров Git-коммитов (cron: ${cronExpression}, ветка ${branch})`)

    const runTick = async (): Promise<void> => {
      const coopname = platformSettings().coopname
      const rawUrls = await this.projectRepository.findDistinctDevelopmentRepositoryUrls(coopname)
      const normalizedKeys = new Map<string, { owner: string; repo: string; key: string }>()
      for (const raw of rawUrls) {
        const key = normalizeDevelopmentRepositoryUrl(raw)
        const parsed = key ? parseGitHubDevelopmentRepository(key) : null
        if (key && parsed) {
          normalizedKeys.set(key, { owner: parsed.owner, repo: parsed.repo, key })
        } else {
          this.logger.warn(`Пропуск URL репозитория (не github.com / owner:repo): ${raw}`)
        }
      }

      if (normalizedKeys.size === 0) {
        this.logger.debug('Маркеры Git: нет проектов с заданным URL репозитория — тик пропущен')
        return
      }

      for (const { owner, repo, key } of normalizedKeys.values()) {
        try {
          await this.gitCommitMarkersSyncService.syncMarkedCommits({
            owner,
            repo,
            branch,
            githubRepositoryKey: key,
          })
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          const trace = error instanceof Error ? error.stack : undefined
          this.logger.error(`Ошибка синхронизации маркеров для ${key}: ${message}`, trace)
        }
      }
    }

    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await runTick()
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const trace = error instanceof Error ? error.stack : undefined
        this.logger.error(`Ошибка в задаче опроса маркеров Git по расписанию: ${message}`, trace)
      }
    })

    try {
      await runTick()
    } catch (error: unknown) {
      this.logger.warn(
        'Первичный опрос маркеров Git не удался, будет повторен по расписанию',
        error instanceof Error ? error.stack : String(error)
      )
    }

    this.logger.log('Планировщик маркеров Git-коммитов инициализирован')
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
