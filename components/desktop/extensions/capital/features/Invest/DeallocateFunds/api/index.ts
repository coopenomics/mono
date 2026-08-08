import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IDeallocateFundsInput,
  IDeallocateFundsOutput,
  IDeallocationLimit,
  IDeallocationLimitInput,
} from 'app/extensions/capital/entities/Invest/model/types';

export async function deallocateFunds(
  data: IDeallocateFundsInput,
): Promise<IDeallocateFundsOutput> {
  const { [Mutations.Capital.DeallocateFunds.name]: result } =
    await client.Mutation(Mutations.Capital.DeallocateFunds.mutation, {
      variables: { data },
    });
  return result;
}

export async function loadDeallocationLimit(
  data: IDeallocationLimitInput,
): Promise<IDeallocationLimit> {
  const { [Queries.Capital.GetDeallocationLimit.name]: result } =
    await client.Query(Queries.Capital.GetDeallocationLimit.query, {
      variables: { data },
    });
  return result;
}
