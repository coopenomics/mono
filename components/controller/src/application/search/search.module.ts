import { Module } from '@nestjs/common';
import { SearchResolver } from './resolvers/search.resolver';

/**
 * Поиск по документам кооператива (C28-21).
 * searchDocuments читает PG-реестр подписанных документов через SIGNED_DOCUMENT_REPOSITORY
 * (глобальный TypeOrmModule). OpenSearch и его индексатор удалены.
 */
@Module({
  providers: [SearchResolver],
})
export class SearchModule {}
