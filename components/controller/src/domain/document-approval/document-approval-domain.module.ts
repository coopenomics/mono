import { Global, Module } from '@nestjs/common';
import { DocumentDeclarationsRegistryService } from './services/document-declarations-registry.service';
import { DocumentApprovalStateService } from './services/document-approval-state.service';
import { DocumentApprovalProposalService } from './services/document-approval-proposal.service';
import { DocumentApprovalNotificationService } from './services/document-approval-notification.service';
import { DocumentApprovalOnboardingAdapter } from './services/document-approval-onboarding.adapter';
import { DocumentApprovalSeedService } from './services/document-approval-seed.service';
import { SystemInfrastructureModule } from '~/infrastructure/system/system-infrastructure.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { DOCUMENT_DECLARATION_QUERY_PORT } from './ports/document-declaration-query.port';

/**
 * Глобальный domain-модуль фабрики утверждений документов: реестр шаблонов
 * кооператива из деклараций ядра и приложений. Порт записи для расширений
 * (`DOCUMENT_DECLARATION_PORT`) биндится в composition root
 * `InnercoopBridgeModule`, как и остальные порты ядра.
 */
@Global()
@Module({
  imports: [DocumentDomainModule, SystemInfrastructureModule],
  providers: [
    DocumentDeclarationsRegistryService,
    {
      provide: DOCUMENT_DECLARATION_QUERY_PORT,
      useExisting: DocumentDeclarationsRegistryService,
    },
    DocumentApprovalStateService,
    DocumentApprovalProposalService,
    DocumentApprovalNotificationService,
    DocumentApprovalOnboardingAdapter,
    DocumentApprovalSeedService,
  ],
  exports: [
    DocumentDeclarationsRegistryService,
    DOCUMENT_DECLARATION_QUERY_PORT,
    DocumentApprovalStateService,
    DocumentApprovalProposalService,
    DocumentApprovalOnboardingAdapter,
    DocumentApprovalSeedService,
  ],
})
export class DocumentApprovalDomainModule {}
