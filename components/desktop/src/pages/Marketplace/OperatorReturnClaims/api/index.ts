import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceReturnClaimView =
  Queries.Marketplace.ListReturnClaimsByBraname.IOutput['marketplaceListReturnClaimsByBraname'][number];

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.ApproveReturnVisit.IOutput['marketplaceApproveReturnVisit'];

export type IListReturnClaimsByBranameInput =
  Queries.Marketplace.ListReturnClaimsByBraname.IInput['data'];

export type IApproveReturnVisitInput =
  Mutations.Marketplace.ApproveReturnVisit.IInput['data'];

export type IRejectReturnRemoteInput =
  Mutations.Marketplace.RejectReturnRemote.IInput['data'];

export type IAcceptReturnAtVisitInput =
  Mutations.Marketplace.AcceptReturnAtVisit.IInput['data'];

export type IRejectReturnAtVisitInput =
  Mutations.Marketplace.RejectReturnAtVisit.IInput['data'];

export async function listReturnClaimsByBraname(
  data: IListReturnClaimsByBranameInput,
): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListReturnClaimsByBraname.name]: result } = await client.Query(
    Queries.Marketplace.ListReturnClaimsByBraname.query,
    { variables: { data } },
  );
  return result;
}

export async function approveReturnVisit(
  data: IApproveReturnVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.ApproveReturnVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveReturnVisit.mutation,
    { variables: { data } },
  );
  return result;
}

export async function rejectReturnRemote(
  data: IRejectReturnRemoteInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnRemote.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnRemote.mutation,
    { variables: { data } },
  );
  return result;
}

export async function acceptReturnAtVisit(
  data: IAcceptReturnAtVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.AcceptReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.AcceptReturnAtVisit.mutation,
    { variables: { data } },
  );
  return result;
}

export async function rejectReturnAtVisit(
  data: IRejectReturnAtVisitInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.RejectReturnAtVisit.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectReturnAtVisit.mutation,
    { variables: { data } },
  );
  return result;
}
