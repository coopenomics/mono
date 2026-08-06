// domain/appstore/appstore-domain.module.ts

import { Module } from '@nestjs/common';
import { ExtensionDomainService } from './services/extension-domain.service';
import { ExtensionLifecycleDomainService } from '~/domain/extension/services/extension-lifecycle-domain.service';
import { ExtensionDomainListingService } from './services/extension-listing-domain.service';
import { ExtensionSchemaMigrationService } from './services/extension-schema-migration.service';
import { ExtensionInteractor } from '~/application/appstore/interactors/extension.interactor';
import { powerupSchemaV2Migration } from '~/extensions/powerup/migrations/powerup-schema-v2.migration';
import { chatcoopManagedMatrixRoomsV2Migration } from '~/extensions/chatcoop/migrations/chatcoop-managed-matrix-rooms-v2.migration';
import { chatcoopManagedMatrixRoomsV3Migration } from '~/extensions/chatcoop/migrations/chatcoop-managed-matrix-rooms-v3.migration';
import { chatcoopStatePgV4Migration } from '~/extensions/chatcoop/migrations/chatcoop-state-pg-v4.migration';
import { chatcoopMessageHistoryIngestCursorV5Migration } from '~/extensions/chatcoop/migrations/chatcoop-message-history-ingest-cursor-v5.migration';
import { marketplaceBootstrapV1Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v1.migration';
import { marketplaceBootstrapV2Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v2.migration';
import { marketplaceBootstrapV3Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v3.migration';
import { marketplaceBootstrapV4Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v4.migration';
import { marketplaceBootstrapV5Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v5.migration';
import { marketplaceBootstrapV6Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v6.migration';
import { marketplaceBootstrapV7Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v7.migration';
import { marketplaceBootstrapV8Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v8.migration';
import { marketplaceBootstrapV9Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v9.migration';
import { marketplaceBootstrapV10Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v10.migration';
import { marketplaceBootstrapV11Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v11.migration';
import { marketplaceBootstrapV12Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v12.migration';
import { marketplaceBootstrapV13Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v13.migration';
import { marketplaceBootstrapV14Migration } from '~/extensions/marketplace/migrations/marketplace-bootstrap-v14.migration';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import { ExtensionsModule } from '~/extensions/extensions.module';
import { nestApp } from '~/index';

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

    // Регистрируем миграции схем расширений
    this.migrationService.registerMigration(powerupSchemaV2Migration);
    this.migrationService.registerMigration(chatcoopManagedMatrixRoomsV2Migration);
    this.migrationService.registerMigration(chatcoopManagedMatrixRoomsV3Migration);
    this.migrationService.registerMigration(chatcoopStatePgV4Migration);
    this.migrationService.registerMigration(chatcoopMessageHistoryIngestCursorV5Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV1Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV2Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV3Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV4Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV5Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV6Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV7Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV8Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV9Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV10Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV11Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV12Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV13Migration);
    this.migrationService.registerMigration(marketplaceBootstrapV14Migration);

    // Устанавливаем расширения по умолчанию
    await this.extensionInteractor.installDefaultApps();

    this.extensionLifecycleDomainService.setAppContext(nestApp);

    // Запускаем инициализацию включенных расширений
    await this.extensionLifecycleDomainService.runApps();

    this.logger.info('[EXTENSION_INIT] Инициализация системы расширений завершена успешно');
  }
}
