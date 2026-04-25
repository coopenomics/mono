import type { MarketContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

export type SupplyOnRequestInputDomainInterface = Omit<
  MarketContract.Actions.SupplyOnRequest.ISupplyOnRequest,
  'document'
> & {
  document: ISignedDocumentDomainInterface;
};
