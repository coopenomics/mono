import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных расхода из блокчейна
 */
export type IExpenseBlockchainData = Omit<
  CapitalContract.Tables.Expenses.IExpense,
  'expense_statement' | 'approved_statement' | 'authorization'
> & {
  expense_statement: ISignedDocument;
  approved_statement: ISignedDocument;
  authorization: ISignedDocument;
};
