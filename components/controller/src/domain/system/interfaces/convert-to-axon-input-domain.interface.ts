import type { ISignedDocument } from '@coopenomics/innercoop';

export interface ConvertToAxonInputDomainInterface {
  coopname: string;
  username: string;
  document: ISignedDocument;
  convert_amount: string;
}
