import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';
import type { ExtendedSignedDocumentDomainInterface } from './extended-signed-document-domain.interface';

export interface DocumentAggregateDomainInterface {
  hash: string;
  document: ExtendedSignedDocumentDomainInterface;
  rawDocument?: GeneratedDocumentDomainInterface;
}
