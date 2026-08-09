import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
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
import { ExpensesInnercoopExpenseChassisAdapter } from './infrastructure/innercoop/expenses-innercoop-expense-chassis.adapter';
import { ExpensePlanEntity } from './infrastructure/entities/expense-plan.entity';
import {
  EXPENSE_PLANS_SERVICE,
  ExpensePlansService,
} from './application/services/expense-plans.service';
import { ExpensePlansResolver } from './application/resolvers/expense-plans.resolver';

/**
 * Расширение «Расходы» цифрового кооператива.
 *
 * Две части одного домена расходов:
 *   - шасси расходов (MVP — Благорост): backend-сторона контракта `expense`
 *     (TypeORM-зеркало on-chain proposals + items, MinIO-bucket `expenses:files`,
 *     GraphQL Query/Mutation, sync через parser2);
 *   - оффчейн-реестр плановых расходов кооператива и его участков (requirement b6
 *     «Экономика КУ», раунд 5) + расчёт 30-дневного резерва — план-записи
 *     совмещаются с процессами шасси на пути оплаты.
 *
 * Расширение НЕ предоставляет собственного «стола» — расход живёт в Столе
 * Благороста, Председателя и участка. Поэтому в `AppRegistry` запись не
 * заводится, модуль подключается напрямую в `ExtensionsModule.register()`.
 *
 * Подробности и план реализации шасси — см. `README.md` рядом.
 */
@Module({
  imports: [
    NestTypeOrmModule.forFeature([ExpensePlanEntity]),
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
    ExpensesInnercoopExpenseChassisAdapter,
    ExpensePlansService,
    { provide: EXPENSE_PLANS_SERVICE, useExisting: ExpensePlansService },
    ExpensePlansResolver,
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
    ExpensesInnercoopExpenseChassisAdapter,
    ExpensePlansService,
    EXPENSE_PLANS_SERVICE,
  ],
})
export class ExpensesPluginModule {}
