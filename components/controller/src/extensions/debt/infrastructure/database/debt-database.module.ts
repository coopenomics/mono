import { Module } from '@nestjs/common';
import { debtStoreProviders } from './debt-stores';

/** База расширения `debt`: зеркало займов — шлюз таблицы на Kysely. */
@Module({
  providers: [...debtStoreProviders],
  exports: [...debtStoreProviders],
})
export class DebtDatabaseModule {}
