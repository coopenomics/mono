import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common'
import { GitHubSyncService } from '../../application/services/github-sync.service'
import * as cron from 'node-cron'
import { config } from '~/config'

/**
 * Сервис планировщика для синхронизации с GitHub
 * Управляет cron задачами для периодической синхронизации из GitHub
 */
@Injectable()
export class GitHubSyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GitHubSyncSchedulerService.name)
  private cronJob: cron.ScheduledTask | null = null
  private githubRepository = ''

  constructor(private readonly githubSyncService: GitHubSyncService) {}

  /**
   * Инициализация планировщика с параметрами репозитория
   */
  initialize(githubRepository: string): void {
    this.githubRepository = githubRepository
  }

  /**
   * Инициализация сервиса при старте модуля
   */
  async onModuleInit() {
    // Проверяем наличие конфигурации GitHub
    if (!this.githubRepository || !config.github.token) {
      this.logger.log('GitHub синхронизация отключена (не указан репозиторий или токен)')
      return
    }

    try {
      // Инициализируем сервис синхронизации
      this.githubSyncService.initialize(this.githubRepository)

      this.logger.log('Инициализация планировщика GitHub синхронизации...')

      // Запускаем синхронизацию каждую минуту
      this.cronJob = cron.schedule('* * * * *', async () => {
        try {
          await this.githubSyncService.syncFromGitHub()
        } catch (error: any) {
          this.logger.error('Ошибка в задаче синхронизации с GitHub по расписанию', error)
        }
      })

      // Выполняем первичную синхронизацию при запуске
      try {
        await this.githubSyncService.syncFromGitHub()
      } catch (error: any) {
        this.logger.warn(
          'Первичная синхронизация с GitHub не удалась, будет повторена попытка при следующем запуске по расписанию',
          error
        )
      }

      this.logger.log('Планировщик GitHub синхронизации успешно инициализирован')
    } catch (error: any) {
      this.logger.error('Не удалось инициализировать GitHub синхронизацию', error)
    }
  }

  /**
   * Остановка сервиса
   */
  async stop() {
    if (this.cronJob) {
      this.cronJob.stop()
      this.cronJob = null
      this.logger.log('Планировщик GitHub синхронизации остановлен')
    }
  }

  /**
   * Обработка уничтожения модуля
   */
  onModuleDestroy(): void {
    this.stop()
  }
}
