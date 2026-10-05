import { Module } from '@nestjs/common';
import { chairmanStoreProviders } from './chairman-stores';

/** База расширения: шлюз таблицы одобрений на Kysely. */
@Module({
  providers: [...chairmanStoreProviders],
  exports: [...chairmanStoreProviders],
})
export class ChairmanDatabaseModule {}
