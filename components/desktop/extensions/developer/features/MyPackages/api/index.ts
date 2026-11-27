// Свои пакеты издателя: регистрация пакета на себя и ключи каталога.
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IMyAssignment = Queries.Extensions.MyPublisherPackages.IOutput[
  typeof Queries.Extensions.MyPublisherPackages.name
][number];
export type IMyToken = Queries.Extensions.MyPublisherTokens.IOutput[
  typeof Queries.Extensions.MyPublisherTokens.name
][number];
export type IIssueInput = Mutations.Extensions.IssueMyPublisherToken.IInput['data'];
export type IIssueOutput = Mutations.Extensions.IssueMyPublisherToken.IOutput[
  typeof Mutations.Extensions.IssueMyPublisherToken.name
];

async function myAssignments(): Promise<IMyAssignment[]> {
  const { [Queries.Extensions.MyPublisherPackages.name]: output } = await client.Query(
    Queries.Extensions.MyPublisherPackages.query,
    { variables: {} },
  );
  return output;
}

async function myTokens(): Promise<IMyToken[]> {
  const { [Queries.Extensions.MyPublisherTokens.name]: output } = await client.Query(
    Queries.Extensions.MyPublisherTokens.query,
    { variables: {} },
  );
  return output;
}

/** Пайщик регистрирует пакет на себя: ядро отказывает, если пакет занят. */
async function registerPackage(username: string, packageId: string): Promise<IMyAssignment> {
  const { [Mutations.Extensions.AddAppsPublisher.name]: output } = await client.Mutation(
    Mutations.Extensions.AddAppsPublisher.mutation,
    { variables: { data: { username, packageId } } },
  );
  return output;
}

async function issueToken(data: IIssueInput): Promise<IIssueOutput> {
  const { [Mutations.Extensions.IssueMyPublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.IssueMyPublisherToken.mutation,
    { variables: { data } },
  );
  return output;
}

async function revokeToken(id: string): Promise<boolean> {
  const { [Mutations.Extensions.RevokeMyPublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.RevokeMyPublisherToken.mutation,
    { variables: { data: { id } } },
  );
  return output;
}

export const api = { myAssignments, myTokens, registerPackage, issueToken, revokeToken };
