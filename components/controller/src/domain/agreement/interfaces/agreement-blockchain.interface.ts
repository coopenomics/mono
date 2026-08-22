import type { SovietContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных соглашения из блокчейна
 */
export type IAgreementBlockchainData = Omit<SovietContract.Tables.Agreements.IAgreement, 'document'> & {
  document: ISignedDocument;
};
