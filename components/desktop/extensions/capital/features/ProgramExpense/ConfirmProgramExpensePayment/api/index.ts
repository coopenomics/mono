import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IConfirmProgramExpensePaymentInput,
  IProgramExpenseTransactionOutput,
} from 'app/extensions/capital/entities/ProgramExpense/model';

async function confirmProgramExpensePayment(
  data: IConfirmProgramExpensePaymentInput,
): Promise<IProgramExpenseTransactionOutput> {
  const { [Mutations.Capital.ConfirmProgramExpensePayment.name]: result } = await client.Mutation(
    Mutations.Capital.ConfirmProgramExpensePayment.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { confirmProgramExpensePayment };
