import { Module } from '@nestjs/common';
import { DocumentResolver } from './resolvers/document.resolver';
import { SignerCertificateResolver } from './resolvers/signer-certificate.resolver';
import { DocumentReproducibilityAuditResolver } from './resolvers/document-reproducibility-audit.resolver';
import { DocumentService } from './services/document.service';
import { PublicProvisionService } from './services/public-provision.service';
import { DocumentReproducibilityAuditService } from './services/document-reproducibility-audit.service';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { DocumentInteractor } from './interactors/document.interactor';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, DocumentDomainModule],
  providers: [
    DocumentResolver,
    SignerCertificateResolver,
    DocumentReproducibilityAuditResolver,
    DocumentService,
    PublicProvisionService,
    DocumentReproducibilityAuditService,
    DocumentInteractor,
  ],
  exports: [DocumentInteractor],
})
export class DocumentModule {}
