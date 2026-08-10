import { Inject, Module } from '@nestjs/common';
import { BaseExtensionModule, EXTENSION_REPOSITORY, type ExtensionDomainRepository, LOG_EXTENSION_REPOSITORY, LogExtensionDomainRepository, DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { z } from 'zod';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import { merge } from 'lodash';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { SystemInfrastructureModule } from '~/infrastructure/system/system-infrastructure.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { SystemDomainModule } from '~/domain/system/system-domain.module';

// Chairman Database and Infrastructure
import { ChairmanDatabaseModule } from './infrastructure/database/chairman-database.module';

// Репозитории
import { ApprovalTypeormRepository } from './infrastructure/repositories/approval.typeorm-repository';

// Blockchain синхронизация
import { ApprovalDeltaMapper } from './infrastructure/blockchain/mappers/approval-delta.mapper';
import { ApprovalSyncService } from './infrastructure/blockchain/services/approval-sync.service';

// Services
import { ApprovalService } from './application/services/approval.service';
import { ApprovalNotificationService } from './application/services/approval-notification.service';
import { ApprovalResponseNotificationService } from './application/services/approval-response-notification.service';
import { DecisionExpiredNotificationService } from './application/services/decision-expired-notification.service';
import { ChairmanOnboardingService } from './application/services/onboarding.service';
import { ChairmanOnboardingEventsService } from './application/services/onboarding-events.service';
import { ChairmanBlockchainAdapter } from './infrastructure/blockchain/adapters/chairman-blockchain.adapter';

// Use Cases
import { ChairmanSyncInteractor } from './application/use-cases/chairman-sync.interactor';

// Resolvers
import { ApprovalResolver } from './application/resolvers/approval.resolver';
import { ChairmanOnboardingResolver } from './application/resolvers/onboarding.resolver';

// Символы для DI
import { APPROVAL_REPOSITORY } from './domain/repositories/approval.repository';
import { CHAIRMAN_BLOCKCHAIN_PORT } from './domain/interfaces/chairman-blockchain.port';
import { registerChairmanOnboardingSteps } from './application/onboarding/register-chairman-onboarding-steps';
import { ONBOARDING_STEP_REGISTRY_PORT, type IOnboardingStepRegistryPort } from '@coopenomics/innercoop';
import { computeOnboardingExpiresAt } from '@coopenomics/extension-kit';

// Функция для описания полей в схеме конфигурации
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Дефолтные параметры конфигурации
export const defaultConfig = {
  checkInterval: 10,
  lastCheckDate: '',
  onboarding_init_at: '',
  onboarding_expire_at: '',
  onboarding_wallet_agreement_hash: '',
  onboarding_signature_agreement_hash: '',
  onboarding_privacy_agreement_hash: '',
  onboarding_user_agreement_hash: '',
  onboarding_participant_application_hash: '',
  onboarding_voskhod_membership_hash: '',
  onboarding_general_meet_hash: '',
  onboarding_wallet_agreement_done: false,
  onboarding_signature_agreement_done: false,
  onboarding_privacy_agreement_done: false,
  onboarding_user_agreement_done: false,
  onboarding_participant_application_done: false,
  onboarding_voskhod_membership_done: false,
  onboarding_general_meet_done: false,
};

// Zod-схема для конфигурации
export const Schema = z.object({
  checkInterval: z
    .number()
    .default(defaultConfig.checkInterval)
    .describe(
      describeField({
        label: 'Интервал проверки истекших решений (в минутах)',
        note: 'Минимум: 1 минута',
        rules: ['val >= 1'],
        prepend: 'Каждые',
        append: 'минут',
      })
    ),
  lastCheckDate: z
    .string()
    .default(defaultConfig.lastCheckDate)
    .describe(describeField({ label: 'Дата последней проверки', visible: false })),
  onboarding_init_at: z
    .string()
    .default(defaultConfig.onboarding_init_at)
    .describe(describeField({ label: 'Дата старта онбординга председателя', visible: false })),
  onboarding_expire_at: z
    .string()
    .default(defaultConfig.onboarding_expire_at)
    .describe(describeField({ label: 'Дата истечения онбординга председателя', visible: false })),
  onboarding_wallet_agreement_done: z
    .boolean()
    .default(defaultConfig.onboarding_wallet_agreement_done)
    .describe(describeField({ label: 'Шаг кошелькового соглашения выполнен', visible: false })),
  onboarding_wallet_agreement_hash: z
    .string()
    .default(defaultConfig.onboarding_wallet_agreement_hash)
    .describe(describeField({ label: 'Hash документа кошелькового соглашения', visible: false })),
  onboarding_signature_agreement_done: z
    .boolean()
    .default(defaultConfig.onboarding_signature_agreement_done)
    .describe(describeField({ label: 'Шаг простой ЭП выполнен', visible: false })),
  onboarding_signature_agreement_hash: z
    .string()
    .default(defaultConfig.onboarding_signature_agreement_hash)
    .describe(describeField({ label: 'Hash документа простой ЭП', visible: false })),
  onboarding_privacy_agreement_done: z
    .boolean()
    .default(defaultConfig.onboarding_privacy_agreement_done)
    .describe(describeField({ label: 'Шаг политики конфиденциальности выполнен', visible: false })),
  onboarding_privacy_agreement_hash: z
    .string()
    .default(defaultConfig.onboarding_privacy_agreement_hash)
    .describe(describeField({ label: 'Hash документа политики конфиденциальности', visible: false })),
  onboarding_user_agreement_done: z
    .boolean()
    .default(defaultConfig.onboarding_user_agreement_done)
    .describe(describeField({ label: 'Шаг пользовательского соглашения выполнен', visible: false })),
  onboarding_user_agreement_hash: z
    .string()
    .default(defaultConfig.onboarding_user_agreement_hash)
    .describe(describeField({ label: 'Hash документа пользовательского соглашения', visible: false })),
  onboarding_participant_application_done: z
    .boolean()
    .default(defaultConfig.onboarding_participant_application_done)
    .describe(describeField({ label: 'Шаг заявлений выполнен', visible: false })),
  onboarding_participant_application_hash: z
    .string()
    .default(defaultConfig.onboarding_participant_application_hash)
    .describe(describeField({ label: 'Hash документа заявлений', visible: false })),
  onboarding_voskhod_membership_done: z
    .boolean()
    .default(defaultConfig.onboarding_voskhod_membership_done)
    .describe(describeField({ label: 'Шаг вступления в ПК «ВОСХОД» выполнен', visible: false })),
  onboarding_voskhod_membership_hash: z
    .string()
    .default(defaultConfig.onboarding_voskhod_membership_hash)
    .describe(describeField({ label: 'Hash решения о вступлении в ПК «ВОСХОД»', visible: false })),
  onboarding_general_meet_done: z
    .boolean()
    .default(defaultConfig.onboarding_general_meet_done)
    .describe(describeField({ label: 'Шаг общего собрания выполнен', visible: false })),
  onboarding_general_meet_hash: z
    .string()
    .default(defaultConfig.onboarding_general_meet_hash)
    .describe(describeField({ label: 'Hash повестки общего собрания', visible: false })),
});

// Тип конфигурации
export type IConfig = z.infer<typeof Schema>;

// Тип для логирования действий
export interface ILog {
  type: 'check' | 'cancel';
  coopname: string;
  decision_id?: string;
  result?: string;
  timestamp?: string; // Делаем опциональным, так как будет добавляться внутри метода log
}

export class ChairmanExtension extends BaseExtensionModule {

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort,
    @Inject(ONBOARDING_STEP_REGISTRY_PORT)
    private readonly onboardingStepRegistration: IOnboardingStepRegistryPort,
    private readonly decisionExpiredNotificationService: DecisionExpiredNotificationService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(ChairmanExtension.name);
  }

  name = 'chairman';
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг не найден');

    // Применяем глубокий мердж дефолтных параметров с существующими
    this.extension = {
      ...extensionData,
      config: merge({}, defaultConfig, extensionData.config),
    };

    // Инициализация таймера онбординга (30 дней с первого запуска)
    const nowIso = new Date().toISOString();
    let needUpdate = false;
    if (!this.extension.config.onboarding_init_at) {
      this.extension.config.onboarding_init_at = nowIso;
      needUpdate = true;
    }
    if (!this.extension.config.onboarding_expire_at) {
      const started = new Date(this.extension.config.onboarding_init_at || nowIso);
      this.extension.config.onboarding_expire_at = computeOnboardingExpiresAt(started);
      needUpdate = true;
    }

    if (needUpdate) {
      await this.extensionRepository.update(this.extension);
    }

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension.config);

    // Регистрация шагов онбординга в платформенном реестре
    registerChairmanOnboardingSteps(this.onboardingStepRegistration);

    // Инициализация сервиса проверки истекших решений
    await this.decisionExpiredNotificationService.initialize(this.extension);
  }
}

@Module({
  imports: [
    ChairmanDatabaseModule,
    AccountInfrastructureModule,
    SystemInfrastructureModule,
    DocumentDomainModule,
    SystemDomainModule,
  ],
  providers: [
    ChairmanExtension,

    // Репозитории
    {
      provide: APPROVAL_REPOSITORY,
      useClass: ApprovalTypeormRepository,
    },
    ApprovalTypeormRepository,

    // Blockchain синхронизация
    ApprovalDeltaMapper,
    ApprovalSyncService,

    // Services
    ApprovalService,
    ApprovalNotificationService,
    ApprovalResponseNotificationService,
    DecisionExpiredNotificationService,
    ChairmanOnboardingService,
    ChairmanOnboardingEventsService,
    {
      provide: CHAIRMAN_BLOCKCHAIN_PORT,
      useClass: ChairmanBlockchainAdapter,
    },
    ChairmanBlockchainAdapter,

    // Use Cases
    ChairmanSyncInteractor,

    // Utils
    DomainToBlockchainUtils,

    // Resolvers
    ApprovalResolver,
    ChairmanOnboardingResolver,
  ],
  exports: [ApprovalSyncService, ChairmanSyncInteractor],
})
export class ChairmanExtensionModule {
  constructor(private readonly chairmanExtension: ChairmanExtension) {}

  async initialize() {
    await this.chairmanExtension.initialize();
  }
}
