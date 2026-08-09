import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных долга из блокчейна
 */
export type IDebtBlockchainData = Omit<
  CapitalContract.Tables.Debts.IDebt,
  'statement' | 'approved_statement' | 'authorization'
> & {
  statement: ISignedDocument;
  approved_statement: ISignedDocument;
  authorization: ISignedDocument;
};
