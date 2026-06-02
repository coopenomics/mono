import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  ITopupProgramExpensePoolInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function topupProgramExpensePool(
  data: ITopupProgramExpensePoolInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.TopupProgramExpensePool.name]: result } = await client.Mutation(
    Mutations.Capital.TopupProgramExpensePool.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { topupProgramExpensePool };
