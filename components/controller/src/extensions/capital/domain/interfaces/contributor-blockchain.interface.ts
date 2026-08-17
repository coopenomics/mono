import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных участника из блокчейна
 */
export type IContributorBlockchainData = Omit<CapitalContract.Tables.Contributors.IContributor, 'contract'> & {
  contract: ISignedDocument;
};
