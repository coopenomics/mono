import { Module } from '@nestjs/common';
import { expensesStoreProviders } from './expenses-stores';

/**
 * База расширения `expense`: зеркало предложений о расходах, реестр файлов,
 * снимки реквизитов получателей и планы расходов — шлюзы таблиц на Kysely.
 */
@Module({
  providers: [...expensesStoreProviders],
  exports: [...expensesStoreProviders],
})
export class ExpensesDatabaseModule {}
