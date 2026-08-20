import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';

export type ISetProjectPriorityInput = Mutations.Capital.SetProjectPriority.IInput['data'];
export type ISetProjectPriorityOutput =
  Mutations.Capital.SetProjectPriority.IOutput[typeof Mutations.Capital.SetProjectPriority.name];

async function setProjectPriority(
  data: ISetProjectPriorityInput,
): Promise<ISetProjectPriorityOutput> {
  const { [Mutations.Capital.SetProjectPriority.name]: result } = await client.Mutation(
    Mutations.Capital.SetProjectPriority.mutation,
    {
      variables: {
        data,
      },
    },
  );

  return result;
}

export const api = {
  setProjectPriority,
};
