import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

// Мутации модерации (approveOffer/rejectOffer) вынесены в feature
// `Marketplace/OfferModeration` — используются и в ленте, и на полной странице
// предложения (DRY). Импортируй их оттуда.

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

export async function fetchModerationLog(
  offer_id: string,
): Promise<MarketplaceModerationLogEntryView> {
  const { [Queries.Marketplace.ListModerationLog.name]: result } = await client.Query(
    Queries.Marketplace.ListModerationLog.query,
    { variables: { offer_id } },
  );
  return result;
}
