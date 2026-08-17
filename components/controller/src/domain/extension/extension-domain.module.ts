// domain/appstore/appstore-domain.module.ts

import { Module } from '@nestjs/common';
import { ExtensionDomainService } from './services/extension-domain.service';
import { ExtensionLifecycleDomainService } from '~/domain/extension/services/extension-lifecycle-domain.service';
import { ExtensionDomainListingService } from './services/extension-listing-domain.service';
import { ExtensionSchemaMigrationService } from './services/extension-schema-migration.service';
import { ExtensionInteractor } from '~/application/appstore/interactors/extension.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import { ExtensionsModule } from '~/extensions/extensions.module';
import { AppRegistry } from '~/extensions/extensions.registry';

@Module({
  imports: [
    ExtensionsModule.register(), // Регистрируем модуль расширений
  ],
  providers: [
    ExtensionDomainService,
    ExtensionLifecycleDomainService,
    ExtensionDomainListingService,
    ExtensionSchemaMigrationService,
    ExtensionInteractor,
  ],
  exports: [
    ExtensionDomainService,
    ExtensionLifecycleDomainService,
    ExtensionDomainListingService,
    ExtensionSchemaMigrationService,
    // Экспортируем ExtensionsModule, чтобы провайдеры из расширений были доступны
    // другим модулям приложения через механизм опциональной инъекции
    ExtensionsModule,
  ],
})
export class ExtensionDomainModule {
  constructor(
    private readonly extensionLifecycleDomainService: ExtensionLifecycleDomainService,
    private readonly migrationService: ExtensionSchemaMigrationService,
    private readonly extensionInteractor: ExtensionInteractor,
    private readonly logger: WinstonLoggerService
  ) {}

  async onModuleInit() {
    this.logger.info('[EXTENSION_INIT] Начинаем инициализацию системы расширений');

    // Миграции схемы конфига объявляет само расширение — записью в реестре.
    // Ядру незачем знать, что у какого-то расширения была v2, а потом v18:
    // порядок применения задаёт список самого расширения.
    for (const extension of Object.values(AppRegistry)) {
      for (const migration of extension.migrations ?? []) {
        this.migrationService.registerMigration(migration);
      }
    }

    // Устанавливаем расширения по умолчанию
    await this.extensionInteractor.installDefaultApps();

    // Запускаем инициализацию включенных расширений
    await this.extensionLifecycleDomainService.runApps();

    this.logger.info('[EXTENSION_INIT] Инициализация системы расширений завершена успешно');
  }
}
