import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

export interface ConvertToAxonInputDomainInterface {
  coopname: string;
  username: string;
  document: ISignedDocumentDomainInterface;
  convert_amount: string;
}
