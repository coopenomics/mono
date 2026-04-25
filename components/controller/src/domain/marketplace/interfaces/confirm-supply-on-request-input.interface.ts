import type { MarketContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

export type ConfirmSupplyOnRequestInputDomainInterface = Omit<
  MarketContract.Actions.ConfirmSupply.IConfirmSupply,
  'document'
> & {
  document: ISignedDocumentDomainInterface;
};
