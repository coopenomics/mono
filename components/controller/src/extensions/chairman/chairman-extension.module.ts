import { Inject, Module } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import {
  LOG_EXTENSION_REPOSITORY,
  LogExtensionDomainRepository,
} from '~/domain/extension/repositories/log-extension-domain.repository';
import { z } from 'zod';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import { merge } from 'lodash';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { MeetInfrastructureModule } from '~/infrastructure/meet/meet-infrastructure.module';
import { SystemInfrastructureModule } from '~/infrastructure/system/system-infrastructure.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { FreeDecisionDomainModule } from '~/domain/free-decision/free-decision.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
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
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import { FreeDecisionInfrastructureModule } from '~/infrastructure/free-decision/free-decision-infrastructure.module';
import { DecisionTrackingInfrastructureModule } from '~/infrastructure/decision-tracking/decision-tracking-infrastructure.module';

// Символы для DI
import { APPROVAL_REPOSITORY } from './domain/repositories/approval.repository';
import { CHAIRMAN_BLOCKCHAIN_PORT } from './domain/interfaces/chairman-blockchain.port';
import { computeOnboardingExpiresAt } from '~/domain/onboarding/constants/onboarding-ttl';
import {
  ONBOARDING_STEP_REGISTRATION_PORT,
  type OnboardingStepRegistrationPort,
} from '~/domain/onboarding/ports/onboarding-step-registration.port';
import { registerChairmanOnboardingSteps } from './application/onboarding/register-chairman-onboarding-steps';

// Функция для описания полей в схеме конфигурации
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Дефолтные параметры конфигурации
export const defaultConfig = {
  checkInterval: 10,
  lastCheckDate: '',
  cancelApprovedDecisions: false,
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
  cancelApprovedDecisions: z
    .boolean()
    .default(defaultConfig.cancelApprovedDecisions)
    .describe(
      describeField({
        label: 'Отменять принятые решения с истекшим сроком',
        note: 'Если включено, истекшие принятые решения также будут отменяться',
      })
    ),
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

export class ChairmanPlugin extends BaseExtModule {

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort,
    @Inject(ONBOARDING_STEP_REGISTRATION_PORT)
    private readonly onboardingStepRegistration: OnboardingStepRegistrationPort,
    private readonly decisionExpiredNotificationService: DecisionExpiredNotificationService,
    private readonly logger: WinstonLoggerService
  ) {
    super();
    this.logger.setContext(ChairmanPlugin.name);
  }

  name = 'chairman';
  plugin!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const pluginData = await this.extensionRepository.findByName(this.name);
    if (!pluginData) throw new Error('Конфиг не найден');

    // Применяем глубокий мердж дефолтных параметров с существующими
    this.plugin = {
      ...pluginData,
      config: merge({}, defaultConfig, pluginData.config),
    };

    // Инициализация таймера онбординга (30 дней с первого запуска)
    const nowIso = new Date().toISOString();
    let needUpdate = false;
    if (!this.plugin.config.onboarding_init_at) {
      this.plugin.config.onboarding_init_at = nowIso;
      needUpdate = true;
    }
    if (!this.plugin.config.onboarding_expire_at) {
      const started = new Date(this.plugin.config.onboarding_init_at || nowIso);
      this.plugin.config.onboarding_expire_at = computeOnboardingExpiresAt(started);
      needUpdate = true;
    }

    if (needUpdate) {
      await this.extensionRepository.update(this.plugin);
    }

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.plugin.config);

    // Регистрация шагов онбординга в платформенном реестре
    registerChairmanOnboardingSteps(this.onboardingStepRegistration);

    // Инициализация сервиса проверки истекших решений
    await this.decisionExpiredNotificationService.initialize(this.plugin);
  }
}

@Module({
  imports: [
    ChairmanDatabaseModule,
    AccountInfrastructureModule,
    MeetInfrastructureModule,
    SystemInfrastructureModule,
    DocumentDomainModule,
    FreeDecisionDomainModule,
    VaultDomainModule,
    FreeDecisionInfrastructureModule,
    DecisionTrackingInfrastructureModule,
    SystemDomainModule,
  ],
  providers: [
    ChairmanPlugin,

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
export class ChairmanPluginModule {
  constructor(private readonly chairmanPlugin: ChairmanPlugin) {}

  async initialize() {
    await this.chairmanPlugin.initialize();
  }
}
