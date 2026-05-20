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
import {
  AGREEMENT_REGISTRATION_PORT,
  type AgreementRegistrationPort,
} from '~/domain/registration/ports/agreement-registration.port';
import { registerMarketplaceInAgreementRegistry } from './application/registration/register-marketplace-in-agreement-registry';

/**
 * Optional-инжектируемый порт файлового хранилища. Имя расширения marketplace
 * подключается к bucket через `@coopenomics/inter` (см. AR31 в epics.md).
 * Адаптер file-storage подключается опционально через DI — поэтому через
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
    @Inject(AGREEMENT_REGISTRATION_PORT)
    private readonly agreementRegistrationPort: AgreementRegistrationPort,
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
    this.registerInAgreementRegistry();

    this.logger.info('marketplace-extension готов');
  }

  /**
   * Регистрация оферты ЦПП «Стол заказов» в платформенном AgreementRegistry
   * (Story 1.2). Использует общий core-механизм `AgreementRegistrationPort` —
   * тот же, через который Capital регистрирует свои оферты. Записи реестра
   * автоматически зачищаются при `EXTENSION_APP_TERMINATE_EVENT`.
   *
   * Пока `MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID` остаётся placeholder'ом
   * (Story 1.7 не выполнена) — функция возвращает false, регистрация
   * пропускается с info-логом; SignUp не предлагает оферту marketplace.
   */
  private registerInAgreementRegistry(): void {
    try {
      const registered = registerMarketplaceInAgreementRegistry(this.agreementRegistrationPort);
      if (registered) {
        this.logger.info('[MARKETPLACE.REGISTRY] зарегистрирована 1 оферта marketplace');
      } else {
        this.logger.info(
          '[MARKETPLACE.REGISTRY] MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID не задан (Story 1.7 не выполнена) — оферта не регистрируется'
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Не удалось зарегистрировать marketplace в AgreementRegistry: ${message}`, stack);
    }
  }

  /**
   * Bucket для хранения изображений Стола заказов и фотографий гарантийного
   * возврата. Имя — `coop-<coopname>` (см. AR31). Если адаптер file-storage
   * отключён конфигурацией — пропускаем шаг с info-логом; install расширения
   * не падает, оставшиеся шаги выполняются.
   */
  private async initBucket(): Promise<void> {
    if (!this.fileStorage) {
      this.logger.info(
        'File storage отключён конфигурацией — пропускаем bucket init'
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
