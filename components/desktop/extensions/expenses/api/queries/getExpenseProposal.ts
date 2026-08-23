import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export type IGetExpenseProposalInput = Queries.Expense.ExpenseProposal.IInput;

export type IExpenseProposalResult =
  Queries.Expense.ExpenseProposal.IOutput[typeof Queries.Expense.ExpenseProposal.name];

export async function getExpenseProposal(
  data: IGetExpenseProposalInput,
): Promise<IExpenseProposalResult> {
  const { [Queries.Expense.ExpenseProposal.name]: result } = await client.Query(
    Queries.Expense.ExpenseProposal.query,
    { variables: data },
  );
  return result;
}
