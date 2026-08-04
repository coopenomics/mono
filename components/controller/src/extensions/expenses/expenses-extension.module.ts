import { Module } from '@nestjs/common';
import { FileStorageInfrastructureModule } from '~/infrastructure/file-storage';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { GeneratorInfrastructureModule } from '~/infrastructure/generator/generator.module';
import { ExpensesDatabaseModule } from './infrastructure/database/expenses-database.module';
import { ExpenseContractInfoService } from './infrastructure/services/expense-contract-info.service';
import { ExpenseProposalDeltaMapper } from './infrastructure/blockchain/mappers/expense-proposal-delta.mapper';
import { ExpensesBlockchainAdapter } from './infrastructure/blockchain/adapters/expenses-blockchain.adapter';
import { ExpenseProposalTypeormRepository } from './infrastructure/repositories/expense-proposal.typeorm-repository';
import { ExpenseFileTypeormRepository } from './infrastructure/repositories/expense-file.typeorm-repository';
import { EXPENSE_PROPOSAL_REPOSITORY } from './domain/repositories/expense-proposal.repository';
import { EXPENSE_FILE_REPOSITORY } from './domain/repositories/expense-file.repository';
import { EXPENSES_BLOCKCHAIN_PORT } from './domain/interfaces/expenses-blockchain.port';
import { ExpenseProposalSyncService } from './application/syncers/expense-proposal-sync.service';
import { ExpensesManagementService } from './application/services/expenses-management.service';
import { ExpensesMutationsService } from './application/services/expenses-mutations.service';
import { ExpenseRequisiteSnapshotsService } from './application/services/expense-requisite-snapshots.service';
import { ExpensesCapitalTriggerService } from './application/services/expenses-capital-trigger.service';
import { ExpensePaymentsListener } from './application/services/expense-payments.listener';
import { ExpenseAdvanceReminderService } from './application/services/expense-advance-reminder.service';
import { ExpenseFilesService } from './application/services/expense-files.service';
import { ExpenseProposalResolver } from './application/resolvers/expense-proposal.resolver';
import { ExpenseMutationsResolver } from './application/resolvers/expense-mutations.resolver';
import { ExpenseFilesResolver } from './application/resolvers/expense-files.resolver';
import { ExpensesInterExpenseChassisAdapter } from './infrastructure/inter/expenses-inter-expense-chassis.adapter';

/**
 * Шасси расходов цифрового кооператива (MVP — Благорост).
 *
 * Backend-сторона контракта `expense`:
 *   - TypeORM-зеркало on-chain proposals + items;
 *   - MinIO-bucket `expenses:files` (платёжки/чеки/возвраты);
 *   - GraphQL Query/Mutation для UI;
 *   - sync через parser2 (после ABI regen).
 *
 * Расширение НЕ предоставляет собственного «стола» — расход живёт в Столе
 * Благороста и Председателя. Поэтому в `AppRegistry` запись не заводится,
 * модуль подключается напрямую в `ExtensionsModule.register()`.
 *
 * Подробности и план реализации — см. `README.md` рядом.
 */
@Module({
  imports: [
    ExpensesDatabaseModule,
    DocumentDomainModule,
    BlockchainModule,
    VaultDomainModule,
    GeneratorInfrastructureModule,
    FileStorageInfrastructureModule.forFeature([ExpenseFilesService]),
  ],
  providers: [
    ExpenseContractInfoService,
    ExpenseProposalDeltaMapper,
    ExpenseProposalTypeormRepository,
    ExpenseFileTypeormRepository,
    {
      provide: EXPENSE_PROPOSAL_REPOSITORY,
      useClass: ExpenseProposalTypeormRepository,
    },
    {
      provide: EXPENSE_FILE_REPOSITORY,
      useClass: ExpenseFileTypeormRepository,
    },
    {
      provide: EXPENSES_BLOCKCHAIN_PORT,
      useClass: ExpensesBlockchainAdapter,
    },
    ExpenseProposalSyncService,
    ExpensesManagementService,
    ExpenseRequisiteSnapshotsService,
    ExpensesMutationsService,
    ExpensesCapitalTriggerService,
    ExpensePaymentsListener,
    ExpenseAdvanceReminderService,
    ExpenseFilesService,
    ExpenseProposalResolver,
    ExpenseMutationsResolver,
    ExpenseFilesResolver,
    ExpensesInterExpenseChassisAdapter,
  ],
  exports: [
    ExpenseContractInfoService,
    ExpenseProposalDeltaMapper,
    EXPENSE_PROPOSAL_REPOSITORY,
    EXPENSE_FILE_REPOSITORY,
    ExpenseProposalSyncService,
    ExpensesManagementService,
    ExpensesMutationsService,
    ExpenseFilesService,
    ExpensesInterExpenseChassisAdapter,
  ],
})
export class ExpensesExtensionModule {}
