import { Inject, Module } from '@nestjs/common';
import { z } from 'zod';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, BaseExtensionModule, DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';

// База данных
import { KuDatabaseModule } from './infrastructure/database/ku-database.module';

// Репозитории
import { KU_DECISION_REPOSITORY } from './domain/repositories/ku-decision.repository';
import { KU_DECISION_QUESTION_REPOSITORY } from './domain/repositories/ku-decision-question.repository';
import { KU_TRUST_REQUEST_REPOSITORY } from './domain/repositories/ku-trust-request.repository';
import { KuDecisionTypeormRepository } from './infrastructure/repositories/ku-decision.typeorm-repository';
import { KuDecisionQuestionTypeormRepository } from './infrastructure/repositories/ku-decision-question.typeorm-repository';
import { KuTrustRequestTypeormRepository } from './infrastructure/repositories/ku-trust-request.typeorm-repository';

// Blockchain
import { KU_BLOCKCHAIN_PORT } from './domain/interfaces/ku-blockchain.port';
import { KuBlockchainAdapter } from './infrastructure/blockchain/adapters/ku-blockchain.adapter';
import { KuContractInfoService } from './infrastructure/services/ku-contract-info.service';
import { KuDecisionDeltaMapper } from './infrastructure/blockchain/mappers/ku-decision-delta.mapper';
import { KuDecisionQuestionDeltaMapper } from './infrastructure/blockchain/mappers/ku-decision-question-delta.mapper';
import { KuTrustRequestDeltaMapper } from './infrastructure/blockchain/mappers/ku-trust-request-delta.mapper';

// Синхронизация
import { KuDecisionSyncService } from './application/syncers/ku-decision-sync.service';
import { KuDecisionQuestionSyncService } from './application/syncers/ku-decision-question-sync.service';
import { KuTrustRequestSyncService } from './application/syncers/ku-trust-request-sync.service';

// Application
import { KuService } from './application/services/ku.service';
import { KuEventsService } from './application/services/ku-events.service';
import { KuResolver } from './application/resolvers/ku.resolver';

// Дефолтные параметры конфигурации
export const defaultConfig = {};

export const Schema = z.object({});

// Интерфейс для параметров конфигурации расширения
export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class KuExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(KuExtension.name);
  }

  name = 'trustee';
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    this.logger.info(`Инициализация расширения «Кооперативный участок» (${this.name})`);
  }
}

@Module({
  imports: [KuDatabaseModule, ],
  providers: [
    // Extension
    KuExtension,

    // Репозитории
    {
      provide: KU_DECISION_REPOSITORY,
      useClass: KuDecisionTypeormRepository,
    },
    {
      provide: KU_DECISION_QUESTION_REPOSITORY,
      useClass: KuDecisionQuestionTypeormRepository,
    },
    {
      provide: KU_TRUST_REQUEST_REPOSITORY,
      useClass: KuTrustRequestTypeormRepository,
    },
    KuDecisionTypeormRepository,
    KuDecisionQuestionTypeormRepository,
    KuTrustRequestTypeormRepository,

    // Blockchain
    {
      provide: KU_BLOCKCHAIN_PORT,
      useClass: KuBlockchainAdapter,
    },
    KuBlockchainAdapter,
    KuContractInfoService,
    KuDecisionDeltaMapper,
    KuDecisionQuestionDeltaMapper,
    KuTrustRequestDeltaMapper,

    // Синхронизация
    KuDecisionSyncService,
    KuDecisionQuestionSyncService,
    KuTrustRequestSyncService,

    // Utils
    DomainToBlockchainUtils,

    // Application
    KuService,
    KuEventsService,
    KuResolver,
  ],
  exports: [KuExtension, KuDecisionSyncService, KuDecisionQuestionSyncService, KuTrustRequestSyncService],
})
export class KuExtensionModule {
  constructor(private readonly kuExtension: KuExtension) {}

  async initialize(config?: IConfig) {
    await this.kuExtension.initialize();
    void config;
  }
}
