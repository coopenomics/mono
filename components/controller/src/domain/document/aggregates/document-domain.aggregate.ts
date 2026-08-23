import type { DocumentDomainEntity } from '../entity/document-domain.entity';
import type { DocumentAggregateDomainInterface } from '../interfaces/document-domain-aggregate.interface';
import type { IExtendedSignedDocument } from '../interfaces/extended-signed-document-domain.interface';

export class DocumentDomainAggregate implements DocumentAggregateDomainInterface {
  hash: string;
  document: IExtendedSignedDocument;
  rawDocument?: DocumentDomainEntity;

  constructor(hash: string, document: IExtendedSignedDocument, rawDocument?: DocumentDomainEntity) {
    this.rawDocument = rawDocument;
    this.document = document;
    this.hash = hash;
  }
}
