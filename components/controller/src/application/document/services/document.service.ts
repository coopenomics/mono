import { Injectable } from '@nestjs/common';
import { DocumentInteractor } from '../interactors/document.interactor';
import type { GetDocumentsInputDTO } from '../dto/get-documents-input.dto';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import type { GenerateAnyDocumentInputDTO } from '../dto/generate-any-document-input.dto';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';

@Injectable()
export class DocumentService {
  constructor(private readonly documentInteractor: DocumentInteractor) {}

  async getDocumentsAggregate(
    data: GetDocumentsInputDTO
  ): Promise<PaginationResultDomainInterface<DocumentPackageAggregateDomainInterface>> {
    const query = {
      ...data.filter,
      receiver: data.username,
    };

    return this.documentInteractor.getDocumentsAggregate({
      query,
      page: data.page,
      limit: data.limit,
      type: data.type,
      after_block: data.after_block,
      before_block: data.before_block,
      actions: data.actions,
    });
  }

  async generateAnyDocument(input: GenerateAnyDocumentInputDTO): Promise<DocumentDomainEntity> {
    return this.documentInteractor.generateDocument({
      data: input.data as any,
      options: input.options,
    });
  }
}
