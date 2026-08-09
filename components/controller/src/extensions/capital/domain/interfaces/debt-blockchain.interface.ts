import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

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
