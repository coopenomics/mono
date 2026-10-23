import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type { IPublishReleaseInput, IPublishReleaseOutput } from '../model';

async function publishRelease(
  data: IPublishReleaseInput,
): Promise<IPublishReleaseOutput> {
  const { [Mutations.Extensions.PublishRelease.name]: result } =
    await client.Mutation(Mutations.Extensions.PublishRelease.mutation, {
      variables: { data },
    });

  return result;
}

export const api = {
  publishRelease,
};
