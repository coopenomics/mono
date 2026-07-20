import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  ICreateProgramExpenseInput,
  ICreateProgramExpenseOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model/types';

export async function createProgramExpense(
  data: ICreateProgramExpenseInput,
): Promise<ICreateProgramExpenseOutput> {
  const { [Mutations.Capital.CreateProgramExpense.name]: result } =
    await client.Mutation(Mutations.Capital.CreateProgramExpense.mutation, {
      variables: { data },
    });
  return result;
}
