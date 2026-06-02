import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IApproveProgramExpenseInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function approveProgramExpense(
  data: IApproveProgramExpenseInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.ApproveProgramExpense.name]: result } = await client.Mutation(
    Mutations.Capital.ApproveProgramExpense.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { approveProgramExpense };
