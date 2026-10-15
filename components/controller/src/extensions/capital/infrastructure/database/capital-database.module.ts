import { Module } from '@nestjs/common';
import { capitalStoreProviders } from './capital-stores';

/** База расширения «Благорост»: шлюзы таблиц на Kysely (C28-81). */
@Module({
  providers: [...capitalStoreProviders],
  exports: [...capitalStoreProviders],
})
export class CapitalDatabaseModule {}
