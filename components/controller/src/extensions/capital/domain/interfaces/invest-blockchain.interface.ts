import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Интерфейс данных инвестиции из блокчейна
 */
export type IInvestBlockchainData = Omit<CapitalContract.Tables.Invests.IInvest, 'statement'> & {
  statement: ISignedDocumentDomainInterface;
};
