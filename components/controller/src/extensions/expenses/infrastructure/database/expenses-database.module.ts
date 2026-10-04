import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseProposalTypeormEntity } from '../entities/expense-proposal.typeorm-entity';
import { expensesStoreProviders } from './expenses-stores';
import { EntityVersionTypeormEntity } from '@coopenomics/extension-kit/sync';

/**
 * База расширения `expense`: зеркало предложений о расходах — на TypeORM
 * (синхронизация с цепью); реестр файлов, снимки реквизитов получателей и
 * планы расходов — шлюзы таблиц на Kysely.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseProposalTypeormEntity,
      EntityVersionTypeormEntity,
    ]),
  ],
  providers: [...expensesStoreProviders],
  exports: [TypeOrmModule, ...expensesStoreProviders],
})
export class ExpensesDatabaseModule {}
