import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type {
  IAllocateFundsInput,
  IAllocateFundsOutput,
} from 'app/extensions/capital/entities/Invest/model/types';

export async function allocateFunds(
  data: IAllocateFundsInput,
): Promise<IAllocateFundsOutput> {
  const { [Mutations.Capital.AllocateFunds.name]: result } =
    await client.Mutation(Mutations.Capital.AllocateFunds.mutation, {
      variables: { data },
    });
  return result;
}
