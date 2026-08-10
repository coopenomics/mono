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
import {
  ONBOARDING_STEP_REGISTRATION_PORT,
  type OnboardingStepRegistrationPort,
} from '~/domain/onboarding/ports/onboarding-step-registration.port';
import {
  SOVIET_BLOCKCHAIN_PORT,
  type SovietBlockchainPort,
} from '~/domain/common/ports/soviet-blockchain.port';
import { Cooperative } from 'cooptypes';
import { MARKETPLACE_AGREEMENT_TYPE } from './constants/marketplace-agreement-ids';
import { registerMarketplaceInAgreementRegistry } from './application/registration/register-marketplace-in-agreement-registry';
import { registerMarketplaceOnboardingSteps } from './application/onboarding/register-marketplace-onboarding-steps';
import { MARKETPLACE_UDATA_PARAMETERS_PORT } from '~/domain/common/ports/marketplace-udata-parameters.port';
import { MarketplaceUdataParametersAdapter } from './application/registration/marketplace-udata-parameters.adapter';

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
    @Inject(ONBOARDING_STEP_REGISTRATION_PORT)
    private readonly onboardingStepRegistration: OnboardingStepRegistrationPort,
    @Inject(SOVIET_BLOCKCHAIN_PORT)
    private readonly sovietBlockchainPort: SovietBlockchainPort,
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

    // Открыть программу ЦПП в цепи, если кооператив её ещё не открыл. Без неё
    // пайщик не может подписать оферту, а ledger2 не пропускает операции по
    // кошелькам Стола заказов.
    await this.ensureCppProgram();

    // Декларируем шаги L1-онбординга в платформенном реестре. Дальше весь flow
    // (free-decision → tracking-rule → DecisionTrackedEvent → _done →
    // ONBOARDING_COMPLETED → restartApp) делает generic-слой.
    registerMarketplaceOnboardingSteps(this.onboardingStepRegistration);

    // Свести L1-состояние из платформенного онбординга: если совет утвердил оба
    // документа (оба onboarding_*_done=true проставлены generic-слушателем по
    // реальному ончейн-решению), но coopAcceptance.accepted ещё не выставлен —
    // выставляем его здесь. Метод идемпотентен: вызывается и на обычном boot, и
    // на auto-restart после ONBOARDING_COMPLETED_EVENT.
    await this.syncCoopAcceptanceFromOnboarding();

    await this.initBucket();
    this.registerInAgreementRegistry();

    this.logger.info('marketplace-extension готов');
  }

  /**
   * Самоинициализация ЦПП в цепи: расширение само открывает свою программу в
   * кооперативе, если её там нет. Раньше это делали руками через cleos на
   * каждый кооператив — и «Восход» на тестнете приехал без программы: оферту
   * подписать было нельзя, а стол при этом рапортовал, что она уже подписана
   * (инцидент 2026-08-10).
   *
   * Идемпотентно: `ensureProgram` не шлёт транзакцию, если программа открыта, —
   * а `initialize()` вызывается на каждом старте и рестарте расширения.
   *
   * Ошибку намеренно проглатываем в лог: цепь может быть недоступна в момент
   * старта, и это не повод не поднимать расширение целиком. Следующий рестарт
   * повторит попытку, а до тех пор гейт честно покажет, что подключение ЦПП не
   * завершено.
   */
  private async ensureCppProgram(): Promise<void> {
    try {
      const { created, program_id } = await this.sovietBlockchainPort.ensureProgram({
        coopname: config.coopname,
        type: MARKETPLACE_AGREEMENT_TYPE,
        title: 'Целевая потребительская программа «Стол заказов»',
      });
      if (created) {
        this.logger.info(
          `[MARKETPLACE.L1] программа ЦПП «Стол заказов» открыта в кооперативе ${config.coopname} (program_id=${program_id})`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[MARKETPLACE.L1] не удалось открыть программу ЦПП: ${message}`);
    }
  }

  /**
   * Единый источник L1-истины для grants-провайдера и `marketplaceCppStatus` —
   * флаг `coopAcceptance.accepted`. Он выводится из платформенного состояния
   * онбординга: «оба документа утверждены Советом» = оба
   * `onboarding_marketplace_*_done`. Так состояние расширения меняется СТРОГО по
   * реально отреканному ончейн-решению совета, без stub-кнопки.
   */
  private async syncCoopAcceptanceFromOnboarding(): Promise<void> {
    const cfg = this.plugin.config as unknown as Record<string, unknown>;
    const allStepsDone =
      Boolean(cfg.onboarding_marketplace_provision_done) &&
      Boolean(cfg.onboarding_marketplace_offer_template_done);

    if (!allStepsDone) return;
    if (this.plugin.config.coopAcceptance?.accepted) return;

    const acceptedAt =
      (cfg.onboarding_marketplace_offer_template_at as string | undefined) ||
      new Date().toISOString();
    const boardDecisionRef =
      (cfg.onboarding_marketplace_provision_hash as string | undefined) || '';

    // Атомарный merge только coopAcceptance: не затираем onboarding_*_done,
    // которые generic-слушатель мог проставить параллельно по решениям совета.
    const merged = await this.extensionRepository.patchConfig(this.name, {
      coopAcceptance: {
        accepted: true,
        document_registry_id:
          Cooperative.Registry.MarketplaceProgramTemplate.registry_id,
        accepted_at: acceptedAt,
        accepted_by_board_decision_id: boardDecisionRef,
      },
    });
    this.plugin = { ...this.plugin, config: merged.config };
    this.logger.info(
      '[MARKETPLACE.L1] coopAcceptance.accepted выставлен по завершению онбординга совета'
    );
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
  providers: [
    MarketplacePlugin,
    {
      provide: MARKETPLACE_UDATA_PARAMETERS_PORT,
      useClass: MarketplaceUdataParametersAdapter,
    },
  ],
  exports: [MarketplacePlugin, MARKETPLACE_UDATA_PARAMETERS_PORT],
})
export class MarketplacePluginModule {
  constructor(private readonly marketplacePlugin: MarketplacePlugin) {}

  async initialize() {
    await this.marketplacePlugin.initialize();
  }
}
