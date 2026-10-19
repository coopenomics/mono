import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type ISubmitExpenseReportInput = Mutations.Expense.SubmitExpenseReport.IInput['data'];

/** Член совета закрывает служебную записку: отчёты по всем строкам приняты. */
export async function submitExpenseReport(data: ISubmitExpenseReportInput) {
  return client.Mutation(Mutations.Expense.SubmitExpenseReport.mutation, {
    variables: { data },
  });
}
