// Ключи API издателя: ключ принимает команда выпуска набора издателя.
// Ключ действует на отмеченные пакеты либо на все пакеты издателя (487-37).
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IApiKey = Queries.Extensions.MyPublisherTokens.IOutput[
  typeof Queries.Extensions.MyPublisherTokens.name
][number];
export type IIssueApiKeyInput = Mutations.Extensions.IssueMyPublisherToken.IInput['data'];
export type IIssueApiKeyOutput = Mutations.Extensions.IssueMyPublisherToken.IOutput[
  typeof Mutations.Extensions.IssueMyPublisherToken.name
];

async function myKeys(): Promise<IApiKey[]> {
  const { [Queries.Extensions.MyPublisherTokens.name]: output } = await client.Query(
    Queries.Extensions.MyPublisherTokens.query,
    { variables: {} },
  );
  return output;
}

async function issueKey(data: IIssueApiKeyInput): Promise<IIssueApiKeyOutput> {
  const { [Mutations.Extensions.IssueMyPublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.IssueMyPublisherToken.mutation,
    { variables: { data } },
  );
  return output;
}

async function revokeKey(id: string): Promise<boolean> {
  const { [Mutations.Extensions.RevokeMyPublisherToken.name]: output } = await client.Mutation(
    Mutations.Extensions.RevokeMyPublisherToken.mutation,
    { variables: { data: { id } } },
  );
  return output;
}

export const api = { myKeys, issueKey, revokeKey };
