import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IAuthorizeProgramExpenseInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function authorizeProgramExpense(
  data: IAuthorizeProgramExpenseInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.AuthorizeProgramExpense.name]: result } = await client.Mutation(
    Mutations.Capital.AuthorizeProgramExpense.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { authorizeProgramExpense };
