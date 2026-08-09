import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных инвестиции из блокчейна
 */
export type IInvestBlockchainData = Omit<CapitalContract.Tables.Invests.IInvest, 'statement'> & {
  statement: ISignedDocument;
};
