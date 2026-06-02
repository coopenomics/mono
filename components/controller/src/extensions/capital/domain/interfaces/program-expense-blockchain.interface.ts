import type { CapitalContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

export type IProgramExpenseBlockchainData = Omit<
  CapitalContract.Tables.ProgramExpenses.IProgramExpense,
  'expense_statement' | 'approved_statement' | 'authorization'
> & {
  expense_statement: ISignedDocumentDomainInterface;
  approved_statement: ISignedDocumentDomainInterface;
  authorization: ISignedDocumentDomainInterface;
};
