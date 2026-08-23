// 487-27: publisher-токены издателей-пайщиков — список / выдача / отзыв.
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IPublisherToken = Queries.Extensions.AppsCatalogPublisherTokens.IOutput[
  typeof Queries.Extensions.AppsCatalogPublisherTokens.name
][number];
export type ICreatePublisherTokenInput = Mutations.Extensions.CreatePublisherToken.IInput['data'];
export type ICreatePublisherTokenOutput = Mutations.Extensions.CreatePublisherToken.IOutput[
  typeof Mutations.Extensions.CreatePublisherToken.name
];

async function listPublisherTokens(): Promise<IPublisherToken[]> {
  const { [Queries.Extensions.AppsCatalogPublisherTokens.name]: output } = await client.Query(
    Queries.Extensions.AppsCatalogPublisherTokens.query,
    { variables: {} },
  );
  return output;
}

async function createPublisherToken(
  data: ICreatePublisherTokenInput,
): Promise<ICreatePublisherTokenOutput> {
  const { [Mutations.Extensions.CreatePublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.CreatePublisherToken.mutation,
    { variables: { data } },
  );
  return output;
}

async function revokePublisherToken(id: string): Promise<boolean> {
  const { [Mutations.Extensions.RevokePublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.RevokePublisherToken.mutation,
    { variables: { data: { id } } },
  );
  return output;
}

export const api = {
  listPublisherTokens,
  createPublisherToken,
  revokePublisherToken,
};
