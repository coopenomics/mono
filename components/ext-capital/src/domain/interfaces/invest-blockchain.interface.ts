import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных инвестиции из блокчейна
 */
export type IInvestBlockchainData = Omit<CapitalContract.Tables.Invests.IInvest, 'statement'> & {
  statement: ISignedDocumentDomainInterface;
};
