import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Интерфейс данных расхода из блокчейна
 */
export type IExpenseBlockchainData = Omit<
  CapitalContract.Tables.Expenses.IExpense,
  'expense_statement' | 'approved_statement' | 'authorization'
> & {
  expense_statement: ISignedDocumentDomainInterface;
  approved_statement: ISignedDocumentDomainInterface;
  authorization: ISignedDocumentDomainInterface;
};
