import { Module } from '@nestjs/common';
import { DocumentDomainService } from './services/document-domain.service';
import { DocumentAggregator } from './aggregators/document.aggregator';
import { DocumentPackageAggregator } from './aggregators/document-package.aggregator';
import { DocumentPackageUtils } from './aggregators/document-package-utils.aggregator';
import { DocumentPackageV0Aggregator } from './aggregators/document-package-v0.aggregator';
import { DocumentPackageV1Aggregator } from './aggregators/document-package-v1.aggregator';
import { DocumentAggregationService } from './services/document-aggregation.service';
import { DocumentValidationService, DOCUMENT_VALIDATION_SERVICE } from './services/document-validation.service';
import { UserDomainModule } from '~/domain/user/user-domain.module';

@Module({
  imports: [UserDomainModule],
  providers: [
    DocumentDomainService,
    DocumentAggregator,
    DocumentPackageAggregator,
    DocumentPackageUtils,
    DocumentPackageV0Aggregator,
    DocumentPackageV1Aggregator,
    DocumentAggregationService,
    DocumentValidationService,
    {
      provide: DOCUMENT_VALIDATION_SERVICE,
      useExisting: DocumentValidationService,
    },
  ],
  exports: [
    DocumentDomainService,
    DocumentAggregator,
    DocumentPackageAggregator,
    DocumentPackageUtils,
    DocumentPackageV0Aggregator,
    DocumentPackageV1Aggregator,
    DocumentAggregationService,
    DocumentValidationService,
    DOCUMENT_VALIDATION_SERVICE,
  ],
})
export class DocumentDomainModule {}
