import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 3 / модерация offer'ов: типизированные запросы через SDK Zeus.
 * Backend Resolver: `marketplace-moderation.resolver.ts`
 * (Query.marketplaceListPendingOffers + Mutation.marketplaceApproveOffer).
 */

export type MarketplaceOfferPage =
  Queries.Marketplace.ListPendingOffers.IOutput['marketplaceListPendingOffers'];

export type MarketplacePendingOfferView = MarketplaceOfferPage['items'][number];

export type MarketplaceModerationLogEntryView =
  Queries.Marketplace.ListModerationLog.IOutput['marketplaceListModerationLog'];

export interface ListPendingOffersVariables {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchPendingOffers(
  variables: ListPendingOffersVariables = {},
): Promise<MarketplaceOfferPage> {
  const input = {
    page: variables.page ?? 1,
    limit: variables.limit ?? 24,
    sortBy: variables.sortBy ?? 'created_at',
    sortOrder: variables.sortOrder ?? 'DESC',
  };
  const { [Queries.Marketplace.ListPendingOffers.name]: page } = await client.Query(
    Queries.Marketplace.ListPendingOffers.query,
    { variables: { input } },
  );
  return page;
}

export async function approveOffer(offer_id: string): Promise<MarketplacePendingOfferView> {
  const { [Mutations.Marketplace.ApproveOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveOffer.mutation,
    { variables: { input: { offer_id } } },
  );
  return result;
}

/**
 * Председатель отклоняет предложение с обязательной причиной (≤1000).
 * Backend: marketplace-moderation.resolver.ts → marketplaceRejectOffer
 * (статус → REJECTED, причина сохраняется в reject_reason и видна поставщику
 * в «Мои предложения»).
 */
export async function rejectOffer(
  offer_id: string,
  reason: string,
): Promise<MarketplacePendingOfferView> {
  const { [Mutations.Marketplace.RejectOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectOffer.mutation,
    { variables: { input: { offer_id, reason } } },
  );
  return result;
}

export async function fetchModerationLog(
  offer_id: string,
): Promise<MarketplaceModerationLogEntryView> {
  const { [Queries.Marketplace.ListModerationLog.name]: result } = await client.Query(
    Queries.Marketplace.ListModerationLog.query,
    { variables: { offer_id } },
  );
  return result;
}
