import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type ICreateExpenseProposalInput = Mutations.Expense.CreateExpenseProposal.IInput['data'];

export async function createExpenseProposal(data: ICreateExpenseProposalInput) {
  return client.Mutation(Mutations.Expense.CreateExpenseProposal.mutation, {
    variables: { data },
  });
}
