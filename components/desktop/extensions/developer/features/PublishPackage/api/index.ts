import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import type { IPublishPackageInput, IPublishPackageOutput } from '../model';

async function publishPackage(
  data: IPublishPackageInput,
): Promise<IPublishPackageOutput> {
  const { [Mutations.Extensions.PublishPackage.name]: result } =
    await client.Mutation(Mutations.Extensions.PublishPackage.mutation, {
      variables: { data },
    });

  return result;
}

export const api = {
  publishPackage,
};
