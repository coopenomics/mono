import type { TableStore } from '@coopenomics/extension-kit';
import type { MigrationRecord as MigrationEntity } from '../infrastructure/database/kysely/records/migration.record';
import logger from '../config/logger';

export class MigrationLogger {
  private logs: string[] = [];
  private version: string;
  private migrationRepository: TableStore<MigrationEntity>;

  constructor(version: string, migrationRepository: TableStore<MigrationEntity>) {
    this.version = version;
    this.migrationRepository = migrationRepository;
  }

  /**
   * Логирует информационное сообщение
   */
  info(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}`;

    this.logs.push(logMessage);
    logger.info(message); // Дублируем в консоль
  }

  /**
   * Логирует предупреждение
   */
  warn(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}`;

    this.logs.push(logMessage);
    logger.warn(message); // Дублируем в консоль
  }

  /**
   * Логирует ошибку
   */
  error(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;

    this.logs.push(logMessage);
    logger.error(message); // Дублируем в консоль
  }

  /**
   * Сохраняет накопленные логи в базу данных
   */
  async saveLogs(): Promise<void> {
    try {
      const logsString = this.logs.join('\n');
      await this.migrationRepository.update({ version: this.version }, { logs: logsString });
    } catch (error) {
      logger.error('Ошибка при сохранении логов миграции:', error);
    }
  }

  /**
   * Получает все накопленные логи
   */
  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Получает логи в виде строки
   */
  getLogsAsString(): string {
    return this.logs.join('\n');
  }
}
