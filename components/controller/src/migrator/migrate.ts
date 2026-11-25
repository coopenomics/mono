import 'reflect-metadata';
import logger from '~/config/logger';
import { MigrationManager } from './migrationManager';
import { runDatabaseMigrations } from './database-migrations';

/**
 * Запуск миграций данных
 */
export const migrateData = async (): Promise<void> => {
  let migrationManager: MigrationManager | null = null;

  try {
    logger.info('===== Начало процесса миграции данных =====');

    // Сначала схема: миграции данных работают с таблицами, которые она создаёт.
    await runDatabaseMigrations();

    logger.info('Инициализация менеджера миграций...');

    // Инициализируем менеджер миграций
    migrationManager = new MigrationManager();
    await migrationManager.initialize();

    logger.info('Менеджер миграций инициализирован успешно');

    // Запускаем миграции
    await migrationManager.runMigrations();

    logger.info('===== Миграция данных успешно завершена =====');
  } catch (error) {
    logger.error('===== Ошибка при выполнении миграции данных =====', error);
    if (error instanceof Error) {
      logger.error('Детали ошибки:', error.message);
      logger.error('Стек ошибки:', error.stack);
    }
    // Выбрасываем ошибку дальше, чтобы процесс завершился с кодом выхода 1
    throw error;
  } finally {
    // Закрываем соединения
    logger.info('Закрытие соединений с базами данных...');
    if (migrationManager) {
      try {
        await migrationManager.close();
        logger.info('Соединение с PostgreSQL закрыто');
      } catch (closeError) {
        logger.error('Ошибка при закрытии соединения с PostgreSQL:', closeError);
      }
    }
    logger.info('===== Процесс миграции данных завершен =====');
  }
};
