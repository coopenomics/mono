import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { ApprovalSyncService } from '../../infrastructure/blockchain/services/approval-sync.service';

/**
 * Интерактор для управления синхронизацией данных Chairman с блокчейном
 *
 * Координирует синхронизацию всех сущностей Chairman:
 * - Approvals (одобрения)
 */
@Injectable()
export class ChairmanSyncInteractor {
  constructor(private readonly approvalSyncService: ApprovalSyncService, @Inject(LOGGER_PORT) private readonly logger: ILoggerPort) {
    this.logger.setContext(ChairmanSyncInteractor.name);
  }

  /**
   * Принудительная пересинхронизация данных после форка
   */
  async forceSyncAfterFork(fromBlock: number): Promise<void> {
    try {
      this.logger.log(`Starting force sync after fork from block ${fromBlock}`);

      // Обрабатываем форк для всех синхронизируемых сущностей
      await this.approvalSyncService.handleFork(fromBlock);

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
      this.logger.log('Синхронизация Chairman успешно инициализирована');
    } catch (error: any) {
      this.logger.error(`Ошибка инициализации синхронизации Chairman: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получение статистики синхронизации
   */
  async getSyncStatistics(): Promise<any> {
    // В будущем можно добавить сбор статистики по всем сервисам синхронизации
    return {
      approvals: {
        // Здесь можно добавить статистику из ApprovalSyncService
      },
    };
  }

  /**
   * Проверка здоровья синхронизации
   */
  async checkSyncHealth(): Promise<boolean> {
    // Проверка здоровья всех сервисов синхронизации
    // Пока возвращаем true, в будущем можно добавить реальные проверки
    return true;
  }
}
