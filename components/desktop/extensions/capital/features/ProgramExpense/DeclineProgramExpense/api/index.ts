import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IDeclineProgramExpenseInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function declineProgramExpense(
  data: IDeclineProgramExpenseInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.DeclineProgramExpense.name]: result } = await client.Mutation(
    Mutations.Capital.DeclineProgramExpense.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { declineProgramExpense };
