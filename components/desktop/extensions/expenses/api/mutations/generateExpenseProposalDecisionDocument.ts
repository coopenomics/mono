import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type IGenerateExpenseProposalDecisionDocumentInput =
  Mutations.Expense.GenerateExpenseProposalDecisionDocument.IInput['data'];

export async function generateExpenseProposalDecisionDocument(
  data: IGenerateExpenseProposalDecisionDocumentInput,
) {
  return client.Mutation(
    Mutations.Expense.GenerateExpenseProposalDecisionDocument.mutation,
    {
      variables: {
        data,
        options: { lang: 'ru' },
      },
    },
  );
}
