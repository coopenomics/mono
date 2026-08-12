import { Inject, Injectable, Module, Optional } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type ExtensionDomainRepository,
  platformSettings,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort,
  COUNCIL_PORT,
  type ICouncilPort,
  REGISTRATION_REGISTRY_PORT,
  type IRegistrationRegistryPort,
  MARKETPLACE_DOCUMENT_PARAMETERS_HOOK,
} from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { merge } from 'lodash';
import { IConfig, defaultConfig, Schema } from './types';
import { MarketplaceExtensionDomainModule } from './domain/marketplace-domain.module';
import { MarketplaceExtensionApplicationModule } from './application/marketplace-application.module';
import { Cooperative } from 'cooptypes';
import { MARKETPLACE_AGREEMENT_TYPE } from './constants/marketplace-agreement-ids';
import { registerMarketplaceInAgreementRegistry } from './application/registration/register-marketplace-in-agreement-registry';
import { registerMarketplaceOnboardingSteps } from './application/onboarding/register-marketplace-onboarding-steps';
import { MarketplaceUdataParametersAdapter } from './application/registration/marketplace-udata-parameters.adapter';
import { ONBOARDING_STEP_REGISTRY_PORT, ONBOARDING_COMPLETED_EVENT, type IOnboardingStepRegistryPort } from '@coopenomics/innercoop';

/**
 * Optional-инжектируемый порт файлового хранилища. Имя расширения marketplace
 * подключается к bucket через `@coopenomics/innercoop` (см. AR31 в epics.md).
 * Адаптер file-storage подключается опционально через DI — поэтому через
 * `@Optional` и опциональный токен.
 */
export const MARKETPLACE_FILE_STORAGE_PORT = Symbol('MARKETPLACE_FILE_STORAGE_PORT');

export interface IMarketplaceFileStoragePort {
  ensureBucket(bucketName: string): Promise<void>;
}

@Injectable()
export class MarketplaceExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(REGISTRATION_REGISTRY_PORT)
    private readonly agreementRegistrationPort: IRegistrationRegistryPort,
    @Inject(ONBOARDING_STEP_REGISTRY_PORT)
    private readonly onboardingStepRegistration: IOnboardingStepRegistryPort,
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Optional()
    @Inject(MARKETPLACE_FILE_STORAGE_PORT)
    private readonly fileStorage: IMarketplaceFileStoragePort | null = null
  ) {
    super();
    this.logger.setContext(MarketplaceExtension.name);
  }

  // Имя в реестре расширений совпадает с ключом AppRegistry['market']
  // (extensions.registry.ts). При установке из Каталога приложений именно это
  // имя приходит в `installExtension({name: "market", ...})`.
  name = 'market';
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг не найден');

    this.extension = {
      ...extensionData,
      config: merge({}, defaultConfig, extensionData.config),
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
      const { created, program_id } = await this.council.ensureProgram({
        coopname: platformSettings().coopname,
        type: MARKETPLACE_AGREEMENT_TYPE,
        title: 'Целевая потребительская программа «Стол заказов»',
      });
      if (created) {
        this.logger.info(
          `[MARKETPLACE.L1] программа ЦПП «Стол заказов» открыта в кооперативе ${platformSettings().coopname} (program_id=${program_id})`
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
    const cfg = this.extension.config as unknown as Record<string, unknown>;
    const allStepsDone =
      Boolean(cfg.onboarding_marketplace_provision_done) &&
      Boolean(cfg.onboarding_marketplace_offer_template_done);

    if (!allStepsDone) return;
    if (this.extension.config.coopAcceptance?.accepted) return;

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
    this.extension = { ...this.extension, config: merged.config };
    this.logger.info(
      '[MARKETPLACE.L1] coopAcceptance.accepted выставлен по завершению онбординга совета'
    );
  }

  /**
   * Регистрация оферты ЦПП «Стол заказов» в платформенном AgreementRegistry
   * (Story 1.2). Использует общий core-механизм `IRegistrationRegistryPort` —
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

    const bucketName = `coop-${platformSettings().coopname}`;
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
    MarketplaceExtension,
    {
      provide: MARKETPLACE_DOCUMENT_PARAMETERS_HOOK,
      useClass: MarketplaceUdataParametersAdapter,
    },
  ],
  exports: [MarketplaceExtension, MARKETPLACE_DOCUMENT_PARAMETERS_HOOK],
})
export class MarketplaceExtensionModule {
  constructor(private readonly marketplaceExtension: MarketplaceExtension) {}

  async initialize() {
    await this.marketplaceExtension.initialize();
  }
}
