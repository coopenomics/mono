import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export type IGetExpenseFilesByProposalInput =
  Queries.Expense.ExpenseFilesByProposal.IInput;

export type IExpenseFilesByProposalResult =
  Queries.Expense.ExpenseFilesByProposal.IOutput[typeof Queries.Expense.ExpenseFilesByProposal.name];

export async function getExpenseFilesByProposal(
  data: IGetExpenseFilesByProposalInput,
): Promise<IExpenseFilesByProposalResult> {
  const { [Queries.Expense.ExpenseFilesByProposal.name]: result } =
    await client.Query(Queries.Expense.ExpenseFilesByProposal.query, {
      variables: data,
    });
  return result;
}
