import { Mutations, Queries, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceWriteoffProposalView =
  Queries.Marketplace.GetWriteoffProposal.IOutput['marketplaceWriteoffProposal'];

export type MarketplaceWriteoffProposalsPageView =
  Queries.Marketplace.ListWriteoffProposals.IOutput['marketplaceListWriteoffProposals'];

export type MarketplaceWriteoffStatementDocumentView = Types.Document.IGeneratedDocument;

export type IListWriteoffProposalsInput =
  Queries.Marketplace.ListWriteoffProposals.IInput['data'];

export type ICreateWriteoffDraftInput =
  Mutations.Marketplace.CreateWriteoffDraft.IInput['data'];

export type IUpdateWriteoffDraftInput =
  Mutations.Marketplace.UpdateWriteoffDraft.IInput['data'];

export type ISubmitWriteoffDraftInput =
  Mutations.Marketplace.SubmitWriteoffDraft.IInput['data'];

export type IWriteoffStatementSignablePayloadInput =
  Queries.Marketplace.WriteoffStatementSignablePayload.IInput['data'];

export type MarketplaceWriteoffCandidateView =
  Queries.Marketplace.ListWriteoffCandidates.IOutput['marketplaceListWriteoffCandidates'][number];

export async function listWriteoffCandidates(): Promise<MarketplaceWriteoffCandidateView[]> {
  const { [Queries.Marketplace.ListWriteoffCandidates.name]: result } = await client.Query(
    Queries.Marketplace.ListWriteoffCandidates.query,
    {},
  );
  return result;
}

export async function getOpenWriteoffDraft(): Promise<MarketplaceWriteoffProposalView | null> {
  const { [Queries.Marketplace.OpenWriteoffDraft.name]: result } = await client.Query(
    Queries.Marketplace.OpenWriteoffDraft.query,
    {},
  );
  return result as MarketplaceWriteoffProposalView | null;
}

export async function listWriteoffProposals(
  data: IListWriteoffProposalsInput,
  options?: { page?: number; limit?: number },
): Promise<MarketplaceWriteoffProposalsPageView> {
  const { [Queries.Marketplace.ListWriteoffProposals.name]: result } = await client.Query(
    Queries.Marketplace.ListWriteoffProposals.query,
    { variables: { data, options } },
  );
  return result;
}

export async function getWriteoffProposal(id: string): Promise<MarketplaceWriteoffProposalView> {
  const { [Queries.Marketplace.GetWriteoffProposal.name]: result } = await client.Query(
    Queries.Marketplace.GetWriteoffProposal.query,
    { variables: { id } },
  );
  return result;
}

export async function getWriteoffStatementSignablePayload(
  data: IWriteoffStatementSignablePayloadInput,
): Promise<MarketplaceWriteoffStatementDocumentView> {
  const { [Queries.Marketplace.WriteoffStatementSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.WriteoffStatementSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function createWriteoffDraft(
  data: ICreateWriteoffDraftInput,
): Promise<MarketplaceWriteoffProposalView> {
  const { [Mutations.Marketplace.CreateWriteoffDraft.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateWriteoffDraft.mutation,
    { variables: { data } },
  );
  return result;
}

export async function updateWriteoffDraft(
  data: IUpdateWriteoffDraftInput,
): Promise<MarketplaceWriteoffProposalView> {
  const { [Mutations.Marketplace.UpdateWriteoffDraft.name]: result } = await client.Mutation(
    Mutations.Marketplace.UpdateWriteoffDraft.mutation,
    { variables: { data } },
  );
  return result;
}

export async function cancelWriteoffDraft(id: string): Promise<boolean> {
  const { [Mutations.Marketplace.CancelWriteoffDraft.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelWriteoffDraft.mutation,
    { variables: { id } },
  );
  return Boolean(result);
}

export async function submitWriteoffDraft(
  data: ISubmitWriteoffDraftInput,
): Promise<MarketplaceWriteoffProposalView> {
  const { [Mutations.Marketplace.SubmitWriteoffDraft.name]: result } = await client.Mutation(
    Mutations.Marketplace.SubmitWriteoffDraft.mutation,
    { variables: { data } },
  );
  return result;
}
