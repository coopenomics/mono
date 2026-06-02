import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  ICreateProgramExpenseInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function createProgramExpense(
  data: ICreateProgramExpenseInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.CreateProgramExpense.name]: result } = await client.Mutation(
    Mutations.Capital.CreateProgramExpense.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { createProgramExpense };
