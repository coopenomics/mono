import { Module } from '@nestjs/common';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { SignedDocumentIngestionService } from './services/signed-document-ingestion.service';
import { SignedDocumentBackfillService } from './services/signed-document-backfill.service';

/**
 * Реестр подписанных документов в Postgres (C28-21).
 *
 * Ingestion-листенер ловит blockchain-события soviet с внутренней шины и наполняет PG-проекцию;
 * backfill — разовый перенос истории. Репозиторий (SIGNED_DOCUMENT_REPOSITORY) и генератор
 * предоставляются глобальными модулями (TypeOrmModule / GeneratorInfrastructureModule).
 *
 * Это единый источник для getDocuments (read-path) и searchDocuments — OpenSearch удалён.
 */
@Module({
  imports: [DocumentDomainModule],
  providers: [SignedDocumentIngestionService, SignedDocumentBackfillService],
  exports: [SignedDocumentIngestionService, SignedDocumentBackfillService],
})
export class SignedDocumentsModule {}
