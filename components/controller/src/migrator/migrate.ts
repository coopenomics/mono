import 'reflect-metadata';
import mongoose from 'mongoose';
import logger from '~/config/logger';
import config from '~/config/config';
import { MigrationManager } from './migrationManager';
import { runDatabaseMigrations } from './database-migrations';

// Настройка подключения к MongoDB
const mongoConnect = async () => {
  try {
    logger.info('Подключение к MongoDB...');
    await mongoose.connect(config.mongoose.url);
    logger.info('Успешное подключение к MongoDB для миграции');
  } catch (error) {
    logger.error('Ошибка подключения к MongoDB:', error);
    throw error;
  }
};

/**
 * Запуск миграций данных
 */
export const migrateData = async (): Promise<void> => {
  let migrationManager: MigrationManager | null = null;

  try {
    logger.info('===== Начало процесса миграции данных =====');

    // Сначала схема: миграции данных работают с таблицами, которые она создаёт.
    await runDatabaseMigrations();

    // Подключаемся к MongoDB
    await mongoConnect();

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
    try {
      await mongoose.disconnect();
      logger.info('Соединение с MongoDB закрыто');
    } catch (mongoCloseError) {
      logger.error('Ошибка при закрытии соединения с MongoDB:', mongoCloseError);
    }
    logger.info('===== Процесс миграции данных завершен =====');
  }
};
