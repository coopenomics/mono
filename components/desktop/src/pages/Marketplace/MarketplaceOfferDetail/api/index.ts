import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOfferDetailView } from '../types';

/**
 * Загрузка одного предложения по идентификатору для страницы с полным
 * описанием. Запрос через типизированный SDK Zeus — raw GraphQL-строки в
 * marketplace запрещены.
 */
export async function fetchOffer(id: string): Promise<MarketplaceOfferDetailView | null> {
  const { [Queries.Marketplace.GetOffer.name]: offer } = await client.Query(
    Queries.Marketplace.GetOffer.query,
    { variables: { id } },
  );
  return offer as MarketplaceOfferDetailView | null;
}
