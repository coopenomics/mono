import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ProjectSyncService } from '../syncers/project-sync.service';
import { SegmentSyncService } from '../syncers/segment-sync.service';

/**
 * Интерактор для управления синхронизацией данных Capital с блокчейном
 *
 * Координирует синхронизацию всех сущностей Capital:
 * - Projects (проекты)
 * - Contributors (участники)
 * - Segments (сегменты)
 * - Commits (коммиты)
 * - Results (результаты)
 * - и другие
 */
@Injectable()
export class CapitalSyncInteractor {
  constructor(
    private readonly projectSyncService: ProjectSyncService,
    private readonly segmentSyncService: SegmentSyncService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(CapitalSyncInteractor.name);
  }

  /**
   * Принудительная пересинхронизация данных после форка
   */
  async forceSyncAfterFork(fromBlock: number): Promise<void> {
    try {
      this.logger.log(`Starting force sync after fork from block ${fromBlock}`);

      // Обрабатываем форк для всех синхронизируемых сущностей
      await this.projectSyncService.handleFork(fromBlock);
      await this.segmentSyncService.handleFork(fromBlock);

      // TODO: Добавить обработку форка для других сущностей
      // await this.contributorSyncService.handleFork(fromBlock);
      // await this.commitSyncService.handleFork(fromBlock);
      // await this.resultSyncService.handleFork(fromBlock);

      this.logger.log(`Force sync after fork completed for block ${fromBlock}`);
    } catch (error: any) {
      this.logger.error(`Ошибка принудительной синхронизации после форка: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Инициализация синхронизации
   * Вызывается при запуске модуля
   */
  async initializeSync(): Promise<void> {
    try {
      this.logger.log('Синхронизация капитализации успешно инициализирована');
    } catch (error: any) {
      this.logger.error(`Ошибка инициализации синхронизации: ${error.message}`, error.stack);
      throw error;
    }
  }
}
