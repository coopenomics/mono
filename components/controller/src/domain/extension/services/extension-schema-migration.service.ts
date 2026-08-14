// domain/extension/services/extension-schema-migration.service.ts
//
// Контракт миграции (IExtensionSchemaMigration, ExtensionSchemaMigrationAfterContext)
// живёт в @coopenomics/extension-kit — его реализуют сами расширения. Здесь остаётся
// только применение миграций: сервис знает про логгер ядра и Nest-приложение,
// поэтому в каркас не выносится.

import { Injectable, Inject } from '@nestjs/common';

/**
 * Чем миграция достаёт провайдеры. Ровно `get` — сузили намеренно: полный
 * `INestApplication` здесь означал бы, что домен расширений знает про точку
 * входа приложения.
 */
export interface ExtensionDependencyResolver {
  get<T = unknown>(token: string | symbol | (new (...args: any[]) => any)): T;
}
import {
  EXTENSION_REPOSITORY,
  ExtensionDomainEntity,
  type ExtensionDomainRepository,
  type ExtensionSchemaMigrationAfterContext,
  type IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Сервис для миграции схем расширений
 * Применяет миграции к конфигурациям расширений при их загрузке
 */
@Injectable()
export class ExtensionSchemaMigrationService {
  private migrations: Map<string, IExtensionSchemaMigration[]> = new Map();

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<any>,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ExtensionSchemaMigrationService.name);
  }

  /**
   * Регистрирует миграцию для расширения
   */
  registerMigration(migration: IExtensionSchemaMigration): void {
    const existing = this.migrations.get(migration.extensionName) || [];
    existing.push(migration);
    existing.sort((a, b) => a.version - b.version);
    this.migrations.set(migration.extensionName, existing);
  }

  /**
   * Применяет все необходимые миграции к конфигурации расширения
   * @param extensionName Имя расширения
   * @param currentConfig Текущая конфигурация из БД
   * @param defaultConfig Дефолтная конфигурация новой схемы
   * @param currentVersion Текущая версия схемы
   * @returns Мигрированная конфигурация и новая версия
   */
  async migrateExtensionConfig<TConfig = any>(
    extensionName: string,
    currentConfig: any,
    defaultConfig: TConfig,
    currentVersion = 1
  ): Promise<{ config: TConfig; version: number; appliedMigrations: IExtensionSchemaMigration[] }> {
    const migrations = this.migrations.get(extensionName) || [];

    this.logger.debug(
      `[MIGRATE_CONFIG] Проверка миграций для расширения ${extensionName}. Текущая версия: ${currentVersion}. Найдено миграций: ${migrations.length}`
    );

    if (migrations.length === 0) {
      this.logger.debug(`[MIGRATE_CONFIG] Миграции для ${extensionName} не найдены`);
      return {
        config: { ...defaultConfig, ...currentConfig } as TConfig,
        version: currentVersion,
        appliedMigrations: [],
      };
    }

    this.logger.debug(
      `[MIGRATE_CONFIG] Доступные миграции для ${extensionName}: ${migrations.map((m) => `v${m.version}`).join(', ')}`
    );

    let migratedConfig = { ...currentConfig };
    let latestVersion = currentVersion;
    const appliedMigrations: IExtensionSchemaMigration[] = [];

    // Применяем миграции по порядку, начиная с версии выше текущей
    for (const migration of migrations) {
      this.logger.debug(
        `[MIGRATE_CONFIG] Проверка миграции v${migration.version} для ${extensionName} (нужна: ${
          migration.version > currentVersion
        })`
      );
      if (migration.version > currentVersion) {
        this.logger.info(
          `[MIGRATE_CONFIG] Применение миграции v${migration.version} для расширения ${extensionName} (текущая версия: ${currentVersion})`
        );
        migratedConfig = migration.migrate(migratedConfig, defaultConfig);
        latestVersion = migration.version;
        appliedMigrations.push(migration);
      } else {
        this.logger.debug(`[MIGRATE_CONFIG] Миграция v${migration.version} пропущена (текущая версия: ${currentVersion})`);
      }
    }

    const finalConfig = { ...defaultConfig, ...migratedConfig } as TConfig;
    this.logger.debug(`[MIGRATE_CONFIG] Финальная версия для ${extensionName}: ${latestVersion}`);

    return { config: finalConfig, version: latestVersion, appliedMigrations };
  }

  /**
   * Применяет миграции и обновляет конфигурацию расширения в БД
   */
  async migrateAndUpdateExtension<TConfig = any>(
    extensionName: string,
    defaultConfig: TConfig,
    // Миграции нужен только резолвинг провайдеров, а не всё приложение:
    // ссылка на само приложение тянула бы за собой точку входа контроллера.
    dependencies?: ExtensionDependencyResolver
  ): Promise<ExtensionDomainEntity<TConfig> | null> {
    this.logger.debug(`[MIGRATION] Начало миграции расширения ${extensionName}`);

    const extension = await this.extensionRepository.findByName(extensionName);
    if (!extension) {
      this.logger.debug(`[MIGRATION] Расширение ${extensionName} не найдено в базе данных`);
      return null;
    }

    const currentVersion = (extension as any).schema_version ?? 1;
    this.logger.debug(`[MIGRATION] Найдено расширение ${extensionName}. Текущая версия: ${currentVersion}`);

    const { config: migratedConfig, version: newVersion, appliedMigrations } = await this.migrateExtensionConfig(
      extensionName,
      extension.config,
      defaultConfig,
      currentVersion
    );

    // Проверяем, изменилась ли конфигурация или версия
    const configChanged = JSON.stringify(extension.config) !== JSON.stringify(migratedConfig);
    const versionChanged = currentVersion !== newVersion;

    this.logger.debug(
      `[MIGRATION] Результаты проверки для ${extensionName}: configChanged=${configChanged}, versionChanged=${versionChanged} (новая версия: ${newVersion})`
    );

    if (configChanged || versionChanged) {
      this.logger.info(`[MIGRATION] Применяем обновление для ${extensionName}`);

      const needsAfterMigrate = appliedMigrations.some((m) => typeof m.afterMigrate === 'function');
      if (needsAfterMigrate && !dependencies) {
        this.logger.warn(
          `[MIGRATION] Расширение ${extensionName}: заданы afterMigrate, но резолвер зависимостей не передан — фаза данных пропущена`
        );
      }

      if (needsAfterMigrate && dependencies) {
        const afterCtx: ExtensionSchemaMigrationAfterContext = {
          resolve: (token) => dependencies.get(token),
          logInfo: (m) => this.logger.info(m),
          logWarn: (m) => this.logger.warn(m),
          logError: (m, err) =>
            this.logger.error(m, err instanceof Error ? err : err !== undefined ? String(err) : undefined),
        };
        for (const m of appliedMigrations) {
          if (m.afterMigrate) {
            this.logger.debug(`[MIGRATION] afterMigrate ${extensionName} v${m.version}`);
            await m.afterMigrate(afterCtx);
          }
        }
      }

      const updatedExtension = await this.extensionRepository.update({
        name: extensionName,
        config: migratedConfig,
        schema_version: newVersion,
      });

      this.logger.info(
        `[MIGRATION] Миграция расширения ${extensionName} завершена успешно. Финальная версия: ${newVersion}`
      );
      return updatedExtension;
    }

    this.logger.debug(`[MIGRATION] Расширение ${extensionName} не требует миграции (версия ${currentVersion})`);
    return extension as ExtensionDomainEntity<TConfig>;
  }
}
