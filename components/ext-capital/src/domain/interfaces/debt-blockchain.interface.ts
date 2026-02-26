import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных долга из блокчейна
 */
export type IDebtBlockchainData = Omit<
  CapitalContract.Tables.Debts.IDebt,
  'statement' | 'approved_statement' | 'authorization'
> & {
  statement: ISignedDocumentDomainInterface;
  approved_statement: ISignedDocumentDomainInterface;
  authorization: ISignedDocumentDomainInterface;
};
