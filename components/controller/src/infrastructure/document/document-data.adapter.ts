import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DocumentDataPort } from '~/domain/document/ports/document-data.port';
import { GetDocumentsDataInputInterface } from '~/domain/document/interfaces/get-documents-data-input-domain.interface';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';

@Injectable()
export class DocumentDataAdapter implements DocumentDataPort {
  constructor(
    @Inject(forwardRef(() => DocumentInteractor))
    private readonly documentInteractor: DocumentInteractor,
    private readonly documentAggregationService: DocumentAggregationService
  ) {}

  async getDocumentsAggregate(
    data: GetDocumentsDataInputInterface
  ): Promise<PaginationResultDomainInterface<DocumentPackageAggregateDomainInterface>> {
    return this.documentInteractor.getDocumentsAggregate({
      type: data.type,
      actions: data.actions,
      after_block: data.after_block,
      before_block: data.before_block,
      page: data.page,
      limit: data.limit,
      query: data.query ?? {},
    });
  }

  async buildDocumentAggregate(document: ISignedDocument): Promise<DocumentAggregateDomainInterface | null> {
    return this.documentAggregationService.buildDocumentAggregate(document);
  }
}
