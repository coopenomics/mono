import { Inject, Injectable, Module, Optional } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { merge } from 'lodash';
import { config } from '~/config';
import { IConfig, defaultConfig, Schema } from './types';
import { MarketplaceExtensionDomainModule } from './domain/marketplace-domain.module';
import { MarketplaceExtensionApplicationModule } from './application/marketplace-application.module';
import { CppRegistryDomainModule } from '~/domain/cpp-registry/cpp-registry-domain.module';
import { CppRegistryDomainService } from '~/domain/cpp-registry/services/cpp-registry-domain.service';
import { MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID } from './constants/marketplace-template-registry';

/**
 * Optional-инжектируемый порт файлового хранилища. Имя расширения marketplace
 * подключается к bucket через `@coopenomics/inter` (см. AR31 в epics.md).
 * До merge PR #359 `feat(file-storage)` адаптера ещё нет — поэтому через
 * `@Optional` и опциональный токен.
 */
export const MARKETPLACE_FILE_STORAGE_PORT = Symbol('MARKETPLACE_FILE_STORAGE_PORT');

export interface IMarketplaceFileStoragePort {
  ensureBucket(bucketName: string): Promise<void>;
}

@Injectable()
export class MarketplacePlugin extends BaseExtModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    private readonly logger: WinstonLoggerService,
    private readonly cppRegistryService: CppRegistryDomainService,
    @Optional()
    @Inject(MARKETPLACE_FILE_STORAGE_PORT)
    private readonly fileStorage: IMarketplaceFileStoragePort | null = null
  ) {
    super();
    this.logger.setContext(MarketplacePlugin.name);
  }

  // Имя в реестре расширений совпадает с ключом AppRegistry['market']
  // (extensions.registry.ts). При установке из Каталога приложений именно это
  // имя приходит в `installExtension({name: "market", ...})`.
  name = 'market';
  plugin!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const pluginData = await this.extensionRepository.findByName(this.name);
    if (!pluginData) throw new Error('Конфиг не найден');

    this.plugin = {
      ...pluginData,
      config: merge({}, defaultConfig, pluginData.config),
    };

    await this.initBucket();
    await this.registerCppTemplate();

    this.logger.info('marketplace-extension готов');
  }

  /**
   * Post-install hook (Story 1.2 / Locked Decisions L8/L9): связывает
   * расширение `market` с template-документом оферты ЦПП в платформенном
   * document registry через `coop_cpp_registry`. Идемпотентен — повторная
   * установка не дублирует запись.
   *
   * Пока Story 1.7 не выполнена (one-time platform setup), константа
   * `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID` = 0 → пишем warn и не создаём
   * запись (Stories 1.4/1.9/1.11 fallback'нут на отсутствие template'а).
   */
  private async registerCppTemplate(): Promise<void> {
    if (MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID <= 0) {
      this.logger.warn(
        'MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID не задан (Story 1.7 ещё не выполнена) — запись в coop_cpp_registry пропущена'
      );
      return;
    }

    await this.cppRegistryService.register({
      template_document_registry_id: MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
      required_for_extension: this.name,
      mvp_hardcoded: true,
    });
  }

  /**
   * Bucket для хранения изображений Стола заказов и фотографий гарантийного
   * возврата. Имя — `coop-<coopname>` (см. AR31). Если адаптер file-storage
   * не подключён (PR #359 не вмержен), пропускаем шаг с warn-логом; install
   * расширения не падает — оставшиеся шаги выполняются.
   */
  private async initBucket(): Promise<void> {
    if (!this.fileStorage) {
      this.logger.warn(
        'File storage не настроен — пропускаем bucket init (PR #359 не вмержен)'
      );
      return;
    }

    const bucketName = `coop-${config.coopname}`;
    await this.fileStorage.ensureBucket(bucketName);
    this.logger.info(`Создан физический бакет '${bucketName}'`);
    this.logger.info('File storage готов');
  }
}

@Module({
  imports: [
    MarketplaceExtensionDomainModule, // Доменный слой (включает инфраструктуру через DIP)
    MarketplaceExtensionApplicationModule, // Слой приложения (GraphQL резолверы и сервисы)
    CppRegistryDomainModule, // Story 1.2 — post-install hook регистрирует template ЦПП в coop_cpp_registry
  ],
  providers: [MarketplacePlugin],
  exports: [MarketplacePlugin],
})
export class MarketplacePluginModule {
  constructor(private readonly marketplacePlugin: MarketplacePlugin) {}

  async initialize() {
    await this.marketplacePlugin.initialize();
  }
}
