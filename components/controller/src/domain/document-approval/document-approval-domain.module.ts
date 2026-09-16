import { Global, Module } from '@nestjs/common';
import { DocumentDeclarationsRegistryService } from './services/document-declarations-registry.service';
import { DocumentApprovalStateService } from './services/document-approval-state.service';
import { DOCUMENT_DECLARATION_QUERY_PORT } from './ports/document-declaration-query.port';

/**
 * Глобальный domain-модуль фабрики утверждений документов: реестр шаблонов
 * кооператива из деклараций ядра и приложений. Порт записи для расширений
 * (`DOCUMENT_DECLARATION_PORT`) биндится в composition root
 * `InnercoopBridgeModule`, как и остальные порты ядра.
 */
@Global()
@Module({
  providers: [
    DocumentDeclarationsRegistryService,
    {
      provide: DOCUMENT_DECLARATION_QUERY_PORT,
      useExisting: DocumentDeclarationsRegistryService,
    },
    DocumentApprovalStateService,
  ],
  exports: [DocumentDeclarationsRegistryService, DOCUMENT_DECLARATION_QUERY_PORT, DocumentApprovalStateService],
})
export class DocumentApprovalDomainModule {}
