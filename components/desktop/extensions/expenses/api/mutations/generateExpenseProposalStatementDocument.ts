import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type IGenerateExpenseProposalStatementDocumentInput =
  Mutations.Expense.GenerateExpenseProposalStatementDocument.IInput['data'];

export async function generateExpenseProposalStatementDocument(
  data: IGenerateExpenseProposalStatementDocumentInput,
) {
  return client.Mutation(
    Mutations.Expense.GenerateExpenseProposalStatementDocument.mutation,
    {
      variables: {
        data,
        options: { lang: 'ru' },
      },
    },
  );
}
