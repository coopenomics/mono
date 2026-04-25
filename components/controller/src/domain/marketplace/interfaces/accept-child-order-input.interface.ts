import type { MarketContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

export type AcceptChildOrderInputDomainInterface = Omit<MarketContract.Actions.AcceptRequest.IAcceptRequest, 'document'> & {
  document: ISignedDocumentDomainInterface;
};
