import { Module } from '@nestjs/common';
import { DocumentResolver } from './resolvers/document.resolver';
import { SignerCertificateResolver } from './resolvers/signer-certificate.resolver';
import { DocumentService } from './services/document.service';
import { PublicProvisionService } from './services/public-provision.service';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { DocumentInteractor } from './interactors/document.interactor';

@Module({
  imports: [DocumentDomainModule],
  providers: [DocumentResolver, SignerCertificateResolver, DocumentService, PublicProvisionService, DocumentInteractor],
  exports: [DocumentInteractor],
})
export class DocumentModule {}
