import './i18n';
import { Inject, Module } from '@nestjs/common';
import { z } from 'zod';
import {
  APP_RIGHTS,
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  RightsGuard,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  DOCUMENT_DECLARATION_PORT,
  LOGGER_PORT,
  type IDocumentDeclarationPort,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { DebtDatabaseModule } from './infrastructure/database/debt-database.module';
import { DebtContractInfoService } from './infrastructure/services/debt-contract-info.service';
import { LoanDeltaMapper } from './infrastructure/blockchain/mappers/loan-delta.mapper';
import { DebtBlockchainAdapter } from './infrastructure/blockchain/adapters/debt-blockchain.adapter';
import { LoanKyselyRepository } from './infrastructure/repositories/loan.kysely-repository';
import { LOAN_REPOSITORY } from './domain/repositories/loan.repository';
import { DEBT_BLOCKCHAIN_PORT } from './domain/interfaces/debt-blockchain.port';
import { LoanSyncService } from './application/syncers/loan-sync.service';
import { LoansService } from './application/services/loans.service';
import { LoanMutationsService } from './application/services/loan-mutations.service';
import { LoanPaymentsListener } from './application/services/loan-payments.listener';
import { LoanNotificationsListener } from './application/services/loan-notifications.listener';
import { DebtLiveFeedService } from './application/services/debt-live-feed.service';
import { LoanTermSchedulerService } from './application/services/loan-term-scheduler.service';
import { LoanQueriesResolver } from './application/resolvers/loan-queries.resolver';
import { LoanMutationsResolver } from './application/resolvers/loan-mutations.resolver';
import { DebtRights } from './application/access/debt-rights';
import { registerDebtDocuments } from './application/onboarding/register-debt-documents';

export const defaultConfig = {};
export const Schema = z.object({});
export type IConfig = z.infer<typeof Schema>;

/**
 * Расширение «Беспроцентные займы»: зеркало реестра займов контракта `debt`,
 * заём под обеспечение паевым взносом, исходящие платежи кассиру и
 * уведомления пайщику. Документы расширения объявляются в реестре шаблонов
 * кооператива на каждом старте.
 */
export class DebtExtension extends BaseExtensionModule {
  name = 'debt';
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(DOCUMENT_DECLARATION_PORT) private readonly documentDeclarations: IDocumentDeclarationPort
  ) {
    super();
    this.logger.setContext(DebtExtension.name);
  }

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (extensionData) {
      this.extension = { ...extensionData, config: { ...defaultConfig, ...(extensionData.config ?? {}) } };
    }
    await registerDebtDocuments(this.documentDeclarations);
    this.logger.log('Расширение «Беспроцентные займы» инициализировано');
  }
}

@Module({
  imports: [DebtDatabaseModule],
  providers: [
    DebtExtension,
    DebtRights,
    { provide: APP_RIGHTS, useExisting: DebtRights },
    RightsGuard,
    DebtContractInfoService,
    LoanDeltaMapper,
    LoanKyselyRepository,
    { provide: LOAN_REPOSITORY, useClass: LoanKyselyRepository },
    { provide: DEBT_BLOCKCHAIN_PORT, useClass: DebtBlockchainAdapter },
    LoanSyncService,
    LoansService,
    LoanMutationsService,
    LoanPaymentsListener,
    LoanNotificationsListener,
    DebtLiveFeedService,
    LoanTermSchedulerService,
    LoanQueriesResolver,
    LoanMutationsResolver,
  ],
  exports: [DebtExtension, LOAN_REPOSITORY, LoansService],
})
export class DebtExtensionModule {
  constructor(private readonly debtExtension: DebtExtension) {}

  async initialize() {
    await this.debtExtension.initialize();
  }
}
