import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных участника из блокчейна
 */
export type IContributorBlockchainData = Omit<CapitalContract.Tables.Contributors.IContributor, 'contract'> & {
  contract: ISignedDocumentDomainInterface;
};
