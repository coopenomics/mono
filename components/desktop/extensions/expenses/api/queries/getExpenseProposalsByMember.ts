import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export type IGetExpenseProposalsByMemberInput =
  Queries.Expense.ExpenseProposalsByMember.IInput;

export type IExpenseProposalsByMemberResult =
  Queries.Expense.ExpenseProposalsByMember.IOutput[typeof Queries.Expense.ExpenseProposalsByMember.name];

export async function getExpenseProposalsByMember(
  data: IGetExpenseProposalsByMemberInput,
): Promise<IExpenseProposalsByMemberResult> {
  const { [Queries.Expense.ExpenseProposalsByMember.name]: result } =
    await client.Query(Queries.Expense.ExpenseProposalsByMember.query, {
      variables: data,
    });
  return result;
}
