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

    this.logger.info('marketplace-extension готов');
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
