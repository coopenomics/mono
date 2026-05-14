import path from 'path';
import fs from 'fs';
import { DataSource, Repository } from 'typeorm';
import { MigrationEntity } from '../infrastructure/database/typeorm/entities/migration.entity';
import config from '../config/config';
import logger from '../config/logger';
import { BlockchainService } from '../infrastructure/blockchain/blockchain.service';
import { WinstonLoggerService } from '../application/logger/logger-app.service';
import { MigrationLogger } from './migration-logger';
import { VaultDomainService } from '../domain/vault/services/vault-domain.service';
import { VaultTypeormRepository } from '../infrastructure/database/typeorm/repositories/vault.typeorm-repository';
import { VaultEntity } from '../infrastructure/database/typeorm/entities/vault.entity';

export interface Migration {
  name: string;
  validUntil?: Date; // Дата в UTC, до которой миграция должна применяться. Если не указана или null, миграция применяется всегда
  up: (services: {
    blockchain: BlockchainService;
    vault: VaultDomainService;
    logger: MigrationLogger;
    dataSource: DataSource;
  }) => Promise<boolean>;
  down?: (services: {
    blockchain: BlockchainService;
    vault: VaultDomainService;
    logger: MigrationLogger;
    dataSource: DataSource;
  }) => Promise<boolean>;
}

export class MigrationManager {
  private dataSource!: DataSource;
  private migrationRepository!: Repository<MigrationEntity>;
  private migrationDir!: string;
  private blockchainService: BlockchainService;
  private vaultDomainService!: VaultDomainService;

  constructor() {
    this.migrationDir = path.join(process.cwd(), '/migrations');

    // Создаем экземпляр логгера для блокчейн-сервиса
    const loggerService = new WinstonLoggerService();

    // Создаем заглушку для VaultDomainService (пока не инициализирован dataSource)
    // Реальный сервис будет создан в initialize()
    const vaultDomainServiceStub = {
      getWif: async () => null,
      setWif: async () => false,
      hasWif: async () => false,
    } as any;

    this.blockchainService = new BlockchainService(loggerService, vaultDomainServiceStub);
  }

  async initialize(): Promise<void> {
    // Инициализируем подключение к PostgreSQL
    this.dataSource = new DataSource({
      type: 'postgres',
      host: config.postgres.host,
      port: Number(config.postgres.port),
      username: config.postgres.username,
      password: config.postgres.password,
      database: config.postgres.database,
      entities: [MigrationEntity, VaultEntity],
      synchronize: true,
    });

    await this.dataSource.initialize();
    this.migrationRepository = this.dataSource.getRepository(MigrationEntity);

    // Создаем настоящий VaultDomainService теперь, когда dataSource готов
    const vaultRepository = new VaultTypeormRepository(this.dataSource.getRepository(VaultEntity));
    this.vaultDomainService = new VaultDomainService(vaultRepository);

    // Пересоздаем BlockchainService с настоящим VaultDomainService
    const loggerService = new WinstonLoggerService();
    this.blockchainService = new BlockchainService(loggerService, this.vaultDomainService);

    logger.info('Миграционный менеджер инициализирован');
  }

  async close(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  // Извлекает версию из имени файла (например, из V1.0.0__initial.ts получаем 1.0.0)
  extractVersionFromFilename(filename: string): string {
    const versionMatch = filename.match(/^V(\d+(\.\d+)*)/);
    if (!versionMatch) {
      throw new Error(`Неверный формат имени файла миграции: ${filename}. Ожидается формат V{версия}__{название}.ts`);
    }
    return versionMatch[1];
  }

  // Извлекает описательное название из имени файла (например, из V1.0.0__initial.ts получаем initial)
  extractDescriptionFromFilename(filename: string): string {
    const descMatch = filename.match(/^V\d+(\.\d+)*__(.+?)(\.[tj]s)?$/);
    if (descMatch && descMatch[2]) {
      return descMatch[2].replace(/_/g, ' ');
    }
    return filename; // Вернуть полное имя файла, если не удалось извлечь описание
  }

  async getMigrationFiles(): Promise<{ filename: string; version: string; description: string }[]> {
    try {
      const files = fs
        .readdirSync(this.migrationDir)
        .filter((file) => (file.endsWith('.ts') || file.endsWith('.js')) && file.startsWith('V'));

      // Извлекаем версии и описания из имен файлов
      const migrations = files.map((filename) => ({
        filename,
        version: this.extractVersionFromFilename(filename),
        description: this.extractDescriptionFromFilename(filename),
      }));

      // Сортируем по версии (используем semver сортировку)
      migrations.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = i < aParts.length ? aParts[i] : 0;
          const bVal = i < bParts.length ? bParts[i] : 0;

          if (aVal !== bVal) {
            return aVal - bVal;
          }
        }

        return 0;
      });

      return migrations;
    } catch (error) {
      logger.error('Ошибка при чтении директории миграций:', error);
      return [];
    }
  }

  async loadMigration(filename: string): Promise<{ migration: Migration; version: string; description: string }> {
    try {
      const filePath = path.join(this.migrationDir, filename);
      // Импортируем файл миграции динамически
      const migration = await import(filePath);
      const version = this.extractVersionFromFilename(filename);
      const description = this.extractDescriptionFromFilename(filename);

      return {
        migration: migration.default,
        version,
        description,
      };
    } catch (error) {
      logger.error(`Ошибка при загрузке миграции ${filename}:`, error);
      throw new Error(`Не удалось загрузить миграцию ${filename} из-за ошибок компиляции TypeScript`);
    }
  }

  async getAppliedMigrations(): Promise<MigrationEntity[]> {
    return this.migrationRepository.find({ order: { version: 'ASC' } });
  }

  async markMigrationAsApplied(version: string, name: string, success: boolean, isTest: boolean): Promise<void> {
    if (isTest) {
      logger.info(
        `[ТЕСТОВАЯ МИГРАЦИЯ] Миграция ${version} отмечена как ${success ? 'успешная' : 'неуспешная'} (но не сохранена в БД)`
      );
      return; // Не сохраняем информацию в БД для тестовых миграций
    }

    await this.migrationRepository.save({
      version,
      name,
      executedAt: new Date(),
      success,
    });
  }

  async runMigration(migration: Migration, version: string, description: string, isTest: boolean): Promise<boolean> {
    // Создаем или обновляем запись в базе данных для сохранения логов
    if (!isTest) {
      const existingMigration = await this.migrationRepository.findOne({ where: { version } });
      if (!existingMigration) {
        // Создаем новую запись
        await this.migrationRepository.save({
          version,
          name: migration.name,
          executedAt: new Date(),
          success: false, // Изначально помечаем как неуспешную
          logs: '', // Пустые логи изначально
        });
      } else {
        // Обновляем существующую запись - сбрасываем статус и логи
        await this.migrationRepository.update(
          { version },
          {
            executedAt: new Date(),
            success: false,
            logs: '',
          }
        );
      }
    }

    // Создаем логгер для миграции
    const migrationLogger = new MigrationLogger(version, this.migrationRepository);

    try {
      if (isTest) {
        migrationLogger.info(`[ТЕСТОВАЯ МИГРАЦИЯ] Запуск миграции ${version} (${description}): ${migration.name}`);
      } else {
        migrationLogger.info(`Запуск миграции ${version} (${description}): ${migration.name}`);
      }

      // Предоставляем блокчейн-сервис, логгер и подключение к БД в миграцию
      const result = await migration.up({
        blockchain: this.blockchainService,
        vault: this.vaultDomainService,
        logger: migrationLogger,
        dataSource: this.dataSource,
      });

      // Обновляем статус миграции в базе данных
      if (!isTest) {
        await this.migrationRepository.update({ version }, { success: result });
      }

      if (isTest) {
        migrationLogger.info(
          `[ТЕСТОВАЯ МИГРАЦИЯ] Миграция ${version} (${description}) выполнена ${result ? 'успешно' : 'с ошибками'}`
        );
      } else {
        migrationLogger.info(`Миграция ${version} (${description}) выполнена ${result ? 'успешно' : 'с ошибками'}`);
      }

      // Сохраняем логи в базе данных
      await migrationLogger.saveLogs();

      return result;
    } catch (error) {
      migrationLogger.error(`Ошибка при выполнении миграции ${version} (${description}): ${error}`);

      // Пытаемся откатить миграцию, если у нее есть метод down
      if (!isTest && migration.down) {
        try {
          migrationLogger.info(`Выполнение отката миграции ${version}...`);
          const rollbackResult = await migration.down({
            blockchain: this.blockchainService,
            vault: this.vaultDomainService,
            logger: migrationLogger,
            dataSource: this.dataSource,
          });
          if (rollbackResult) {
            migrationLogger.info(`Откат миграции ${version} выполнен успешно`);
          } else {
            migrationLogger.error(`Откат миграции ${version} завершился с ошибкой`);
          }
        } catch (rollbackError) {
          migrationLogger.error(`Критическая ошибка при откате миграции ${version}: ${rollbackError}`);
        }
      } else if (!isTest && !migration.down) {
        migrationLogger.warn(`Миграция ${version} не имеет метода down для автоматического отката`);
      }

      // Обновляем статус миграции в базе данных
      if (!isTest) {
        await this.migrationRepository.update({ version }, { success: false });
      }

      // Сохраняем логи даже в случае ошибки
      await migrationLogger.saveLogs();

      return false;
    }
  }

  async runMigrations(): Promise<void> {
    try {
      logger.info('Запуск миграций данных...');

      // Получаем все файлы миграций с их версиями и описаниями
      const migrationFiles = await this.getMigrationFiles();
      logger.info(`Найдено ${migrationFiles.length} файлов миграций`);

      // Вывод списка найденных миграций
      if (migrationFiles.length > 0) {
        logger.info('Список найденных миграций:');
        migrationFiles.forEach(({ version, description, filename }) => {
          logger.info(`- ${version}: ${description} (${filename})`);
        });
      }

      // Получаем уже примененные миграции
      const appliedMigrations = await this.getAppliedMigrations();
      logger.info(`В базе данных найдено ${appliedMigrations.length} примененных миграций`);

      // Создаем Map для быстрого поиска миграций по версии с их статусом
      // Нормализуем версии в базе данных для поиска (убираем V если есть)
      const appliedMigrationsMap = new Map(
        appliedMigrations.map((m) => [m.version.startsWith('V') ? m.version.substring(1) : m.version, m])
      );
      const currentDate = new Date();

      for (const { filename, version, description } of migrationFiles) {
        const isTest = filename.includes('__test');

        // Проверяем, применялась ли уже миграция
        const existingMigration = appliedMigrationsMap.get(version);

        // Обычные миграции пропускаем, если уже успешно применялись
        if (!isTest && existingMigration && existingMigration.success) {
          logger.info(`Миграция ${version} (${description}) уже успешно применена, пропускаем`);
          continue;
        }

        // Если миграция применялась но с ошибкой, повторяем её
        if (!isTest && existingMigration && !existingMigration.success) {
          logger.info(`Миграция ${version} (${description}) ранее завершилась с ошибкой, повторяем`);
        }

        // Грузим файл миграции
        const result = await this.loadMigration(filename);

        const { migration } = result;

        // Проверяем дату валидности миграции
        if (migration.validUntil && currentDate > migration.validUntil) {
          logger.info(
            `Миграция ${version} (${description}) не будет применена, так как дата валидности истекла (${migration.validUntil.toISOString()})`
          );
          continue;
        }

        // Если это тестовая миграция, сообщаем об этом
        if (isTest) {
          logger.info(`Миграция ${version} (${description}) запускается в ТЕСТОВОМ режиме (по имени файла)`);
        }

        // Запускаем миграцию
        const success = await this.runMigration(migration, version, description, isTest);

        // Останавливаем процесс только при ошибке в НЕ тестовых миграциях
        if (!success && !isTest) {
          logger.error(`Миграция ${version} (${description}) завершена с ошибкой, останавливаем процесс`);
          throw new Error(`Миграция ${version} (${description}) завершилась с ошибкой`);
        }
      }

      logger.info('Процесс миграций завершен');
    } catch (error) {
      logger.error('Ошибка в процессе миграции:', error);
      throw error;
    }
  }

  async rollbackMigration(version: string): Promise<boolean> {
    try {
      // Нормализуем версию - убираем префикс V если он есть
      const normalizedVersion = version.startsWith('V') ? version.substring(1) : version;
      logger.info(`Откат миграции ${version}...`);

      // Проверяем, существует ли миграция
      const migrationRecord = await this.migrationRepository.findOne({ where: { version: normalizedVersion } });
      if (!migrationRecord) {
        logger.warn(`Миграция ${version} не найдена в базе данных`);
        return false;
      }

      // Находим файл миграции
      const migrationFiles = await this.getMigrationFiles();
      const migrationFile = migrationFiles.find((m) => m.version === normalizedVersion);

      if (!migrationFile) {
        logger.warn(`Файл миграции ${version} не найден`);
        return false;
      }

      // Загружаем миграцию
      const result = await this.loadMigration(migrationFile.filename);

      const { migration } = result;

      // Проверяем, есть ли метод down
      if (!migration.down) {
        logger.warn(`Миграция ${version} не имеет метода down для отката`);
        return false;
      }

      // Создаем логгер для миграции
      const migrationLogger = new MigrationLogger(version, this.migrationRepository);

      logger.info(`Выполнение отката миграции ${version}: ${migration.name}`);

      // Выполняем откат
      const rollbackResult = await migration.down({
        blockchain: this.blockchainService,
        vault: this.vaultDomainService,
        logger: migrationLogger,
        dataSource: this.dataSource,
      });

      if (rollbackResult) {
        // Удаляем запись о миграции из базы данных
        await this.migrationRepository.delete({ version: normalizedVersion });

        // Проверяем, что миграция удалена из базы
        const deletedMigration = await this.migrationRepository.findOne({ where: { version: normalizedVersion } });

        if (!deletedMigration) {
          logger.info(`✅ Запись о миграции ${version} удалена из базы данных`);
        }

        logger.info(`Миграция ${normalizedVersion} успешно откачена`);
        return true;
      } else {
        logger.error(`Ошибка при откате миграции ${version}`);
        return false;
      }
    } catch (error) {
      logger.error(`Ошибка при откате миграции ${version}:`, error);
      return false;
    }
  }

  async rollbackLatestMigration(): Promise<boolean> {
    try {
      logger.info('Поиск последней успешно выполненной миграции для отката...');

      // Получаем все успешно выполненные миграции, отсортированные по версии (новые сверху)
      const successfulMigrations = await this.migrationRepository.find({
        where: { success: true },
        order: { version: 'DESC' },
      });

      if (successfulMigrations.length === 0) {
        logger.warn('Нет успешно выполненных миграций для отката');
        return false;
      }

      const latestMigration = successfulMigrations[0];
      logger.info(`Найдена последняя миграция для отката: ${latestMigration.version} - ${latestMigration.name}`);

      // Выполняем откат этой миграции
      return await this.rollbackMigration(latestMigration.version);
    } catch (error) {
      logger.error('Ошибка при откате последней миграции:', error);
      return false;
    }
  }

  async runSpecificMigration(version: string): Promise<boolean> {
    try {
      // Нормализуем версию - убираем префикс V если он есть
      const normalizedVersion = version.startsWith('V') ? version.substring(1) : version;
      logger.info(`Запуск конкретной миграции ${version}...`);

      // Находим файл миграции
      const migrationFiles = await this.getMigrationFiles();
      const migrationFile = migrationFiles.find((m) => m.version === normalizedVersion);

      if (!migrationFile) {
        logger.warn(`Файл миграции ${version} не найден`);
        return false;
      }

      // Загружаем миграцию
      const result = await this.loadMigration(migrationFile.filename);

      const { migration } = result;

      // Запускаем миграцию
      const success = await this.runMigration(migration, migrationFile.version, migrationFile.description, false);

      if (success) {
        logger.info(`Миграция ${version} успешно выполнена`);
      } else {
        logger.error(`Ошибка при выполнении миграции ${version}`);
      }

      return success;
    } catch (error) {
      logger.error(`Ошибка при запуске миграции ${version}:`, error);
      return false;
    }
  }
}
