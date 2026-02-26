import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных возврата из программы из блокчейна
 */
export type IProgramWithdrawBlockchainData = Omit<CapitalContract.Tables.ProgramWithdraws.IProgramWithdraw, 'statement'> & {
  statement: ISignedDocumentDomainInterface;
};
