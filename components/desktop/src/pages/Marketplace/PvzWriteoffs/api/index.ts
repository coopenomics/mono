import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceWriteoffConfirmationGroupView =
  Queries.Marketplace.WriteoffPendingConfirmations.IOutput['marketplaceWriteoffPendingConfirmations'][number];

export type MarketplaceWriteoffServiceMemoDocumentView = Types.Document.IGeneratedDocument;

export type IConfirmWriteoffInput = Mutations.Marketplace.ConfirmWriteoff.IInput['data'];

export type IServiceMemoSignablePayloadInput =
  Queries.Marketplace.WriteoffServiceMemoSignablePayload.IInput['data'];

export async function listWriteoffPendingConfirmations(): Promise<
  MarketplaceWriteoffConfirmationGroupView[]
> {
  const { [Queries.Marketplace.WriteoffPendingConfirmations.name]: result } = await client.Query(
    Queries.Marketplace.WriteoffPendingConfirmations.query,
    {},
  );
  return result;
}

export async function getWriteoffServiceMemoSignablePayload(
  data: IServiceMemoSignablePayloadInput,
): Promise<MarketplaceWriteoffServiceMemoDocumentView> {
  const { [Queries.Marketplace.WriteoffServiceMemoSignablePayload.name]: result } =
    await client.Query(Queries.Marketplace.WriteoffServiceMemoSignablePayload.query, {
      variables: { data },
    });
  return result;
}

export async function confirmWriteoff(data: IConfirmWriteoffInput): Promise<unknown> {
  const { [Mutations.Marketplace.ConfirmWriteoff.name]: result } = await client.Mutation(
    Mutations.Marketplace.ConfirmWriteoff.mutation,
    { variables: { data } },
  );
  return result;
}
