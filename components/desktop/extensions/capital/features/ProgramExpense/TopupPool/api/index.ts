import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  ITopupProgramExpenseInput,
  ITopupProgramExpenseOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model/types';

export async function topupProgramExpense(
  data: ITopupProgramExpenseInput,
): Promise<ITopupProgramExpenseOutput> {
  const { [Mutations.Capital.TopupProgramExpense.name]: result } =
    await client.Mutation(Mutations.Capital.TopupProgramExpense.mutation, {
      variables: { data },
    });
  return result;
}
