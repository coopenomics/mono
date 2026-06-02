import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  IProgramExpense,
  IProgramExpensesPagination,
  IGetProgramExpenseInput,
  IGetProgramExpensesInput,
} from '../model/types';

async function loadProgramExpenses(
  data: IGetProgramExpensesInput,
): Promise<IProgramExpensesPagination> {
  const { [Queries.Capital.GetProgramExpenses.name]: output } = await client.Query(
    Queries.Capital.GetProgramExpenses.query,
    {
      variables: data,
    },
  );
  return output;
}

async function loadProgramExpense(data: IGetProgramExpenseInput): Promise<IProgramExpense> {
  const { [Queries.Capital.GetProgramExpense.name]: output } = await client.Query(
    Queries.Capital.GetProgramExpense.query,
    {
      variables: { data },
    },
  );
  return output;
}

export const api = {
  loadProgramExpenses,
  loadProgramExpense,
};
