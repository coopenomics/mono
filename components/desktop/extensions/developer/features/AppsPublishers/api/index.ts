// 487-27: назначения издателей «аккаунт → пакет» (председатель).
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IAppsPublisher = Queries.Extensions.AppsPublishers.IOutput[
  typeof Queries.Extensions.AppsPublishers.name
][number];
export type IAssignmentInput = Mutations.Extensions.AddAppsPublisher.IInput['data'];

async function listPublishers(): Promise<IAppsPublisher[]> {
  const { [Queries.Extensions.AppsPublishers.name]: output } = await client.Query(
    Queries.Extensions.AppsPublishers.query,
    { variables: {} },
  );
  return output;
}

async function addPublisher(data: IAssignmentInput): Promise<IAppsPublisher> {
  const { [Mutations.Extensions.AddAppsPublisher.name]: output } = await client.Mutation(
    Mutations.Extensions.AddAppsPublisher.mutation,
    { variables: { data } },
  );
  return output;
}

async function removePublisher(data: IAssignmentInput): Promise<boolean> {
  const { [Mutations.Extensions.RemoveAppsPublisher.name]: output } = await client.Mutation(
    Mutations.Extensions.RemoveAppsPublisher.mutation,
    { variables: { data } },
  );
  return output;
}

export const api = { listPublishers, addPublisher, removePublisher };
