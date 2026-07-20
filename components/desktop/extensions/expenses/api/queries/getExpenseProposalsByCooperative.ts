import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export type IGetExpenseProposalsByCooperativeInput =
  Queries.Expense.ExpenseProposalsByCooperative.IInput;

export type IExpenseProposalsByCooperativeResult =
  Queries.Expense.ExpenseProposalsByCooperative.IOutput[typeof Queries.Expense.ExpenseProposalsByCooperative.name];

export async function getExpenseProposalsByCooperative(
  data: IGetExpenseProposalsByCooperativeInput,
): Promise<IExpenseProposalsByCooperativeResult> {
  const { [Queries.Expense.ExpenseProposalsByCooperative.name]: result } =
    await client.Query(Queries.Expense.ExpenseProposalsByCooperative.query, {
      variables: data,
    });
  return result;
}
