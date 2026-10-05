import { Module } from '@nestjs/common';
import { SearchResolver } from './resolvers/search.resolver';
import { ParticipantsSearchProvider } from './providers/participants-search.provider';
import { DocumentsSearchProvider } from './providers/documents-search.provider';

/**
 * Поиск по документам кооператива (C28-21) и единый поиск окна столов (C28-86).
 * searchDocuments читает PG-реестр подписанных документов через SIGNED_DOCUMENT_REPOSITORY
 * (глобальный KyselyModule). OpenSearch и его индексатор удалены.
 * Поставщики ядра — пайщики и документы — сами кладут себя в глобальный
 * GlobalSearchRegistry; поставщики расширений приходят туда через порт.
 */
@Module({
  providers: [SearchResolver, ParticipantsSearchProvider, DocumentsSearchProvider],
})
export class SearchModule {}
