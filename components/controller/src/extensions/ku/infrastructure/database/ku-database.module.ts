import { Module } from '@nestjs/common';
import { kuStoreProviders } from './ku-stores';

/** База расширения: шлюзы таблиц зеркал участка на Kysely. */
@Module({
  providers: [...kuStoreProviders],
  exports: [...kuStoreProviders],
})
export class KuDatabaseModule {}
