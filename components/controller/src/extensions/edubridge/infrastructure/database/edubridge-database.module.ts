import { Module } from '@nestjs/common';
import { edubridgeStoreProviders } from './edubridge-stores';

/**
 * База расширения `edubridge`: курсы и справочник каталога, обучающиеся и
 * подписки, преподаватели, очередь выдачи доступа — шлюзы таблиц на Kysely.
 */
@Module({
  providers: [...edubridgeStoreProviders],
  exports: [...edubridgeStoreProviders],
})
export class EdubridgeDatabaseModule {}
