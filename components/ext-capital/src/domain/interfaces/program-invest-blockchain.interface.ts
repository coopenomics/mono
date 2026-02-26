import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных программной инвестиции из блокчейна
 */
export type IProgramInvestBlockchainData = Omit<CapitalContract.Tables.ProgramInvests.IProgramInvest, 'statement'> & {
  statement: ISignedDocumentDomainInterface;
};
