import { Inject, Injectable } from '@nestjs/common';
import type {
  IDocumentPort,
  InnerDocumentAggregate,
  InnerDocumentValidation,
  InnerGeneratedDocument,
  InnerGenerateDocumentRequest,
  ISignedDocument,
} from '@coopenomics/innercoop';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';
import {
  DOCUMENT_VALIDATION_SERVICE,
  type DocumentValidationService,
} from '~/domain/document/services/document-validation.service';

/**
 * Реализация `IDocumentPort` для расширений.
 *
 * Сводит в один контракт четыре операции, за которыми расширения раньше ходили
 * в три разных сервиса ядра. Маппинга почти нет: доменные типы совпадают с
 * контрактом по форме, разница только в том, что контракт не знает cooptypes.
 */
@Injectable()
export class DocumentInnercoopAdapter implements IDocumentPort {
  constructor(
    @Inject(DocumentInteractor)
    private readonly documentInteractor: DocumentInteractor,
    private readonly documentDomainService: DocumentDomainService,
    private readonly documentAggregationService: DocumentAggregationService,
    @Inject(DOCUMENT_VALIDATION_SERVICE)
    private readonly documentValidationService: DocumentValidationService
  ) {}

  async generate(request: InnerGenerateDocumentRequest): Promise<InnerGeneratedDocument> {
    return this.documentInteractor.generateDocument(request as any);
  }

  async getByHash(hash: string): Promise<InnerGeneratedDocument | null> {
    return this.documentInteractor.getDocumentByHash(hash);
  }

  async buildAggregate(signedDocument: ISignedDocument): Promise<InnerDocumentAggregate | null> {
    return this.documentAggregationService.buildDocumentAggregate(signedDocument);
  }

  async saveData(payload: Record<string, unknown>, registryId: number): Promise<{ hash: string }> {
    return this.documentDomainService.saveDocData(payload, registryId);
  }

  async validateSigned(id: string, signedDocument: ISignedDocument): Promise<InnerDocumentValidation> {
    return this.documentValidationService.validateSignedDocument(id, signedDocument);
  }
}
