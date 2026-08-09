import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';
import type { IExtendedSignedDocument } from './extended-signed-document-domain.interface';

export interface DocumentAggregateDomainInterface {
  hash: string;
  document: IExtendedSignedDocument;
  rawDocument?: GeneratedDocumentDomainInterface;
}
