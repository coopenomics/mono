// Свои пакеты издателя: перечень назначений и регистрация пакета на себя.
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IMyAssignment = Queries.Extensions.MyPublisherPackages.IOutput[
  typeof Queries.Extensions.MyPublisherPackages.name
][number];

async function myAssignments(): Promise<IMyAssignment[]> {
  const { [Queries.Extensions.MyPublisherPackages.name]: output } = await client.Query(
    Queries.Extensions.MyPublisherPackages.query,
    { variables: {} },
  );
  return output;
}

async function registerPackage(username: string, packageId: string): Promise<IMyAssignment> {
  const { [Mutations.Extensions.AddAppsPublisher.name]: output } = await client.Mutation(
    Mutations.Extensions.AddAppsPublisher.mutation,
    { variables: { data: { username, packageId } } },
  );
  return output;
}

export const api = { myAssignments, registerPackage };
