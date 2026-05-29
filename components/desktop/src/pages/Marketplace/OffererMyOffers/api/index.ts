import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOfferPage } from '../types';

/**
 * Эпик 3 / Story 3.4: «Мои предложения» для поставщика.
 * Backend Resolver: marketplace-offer.resolver.ts → marketplaceListMyOffers.
 * Read policy: ownership проверяется в `MarketplaceOfferService`
 * (supplier_account = текущий пайщик).
 *
 * Возвращает Offer'ы всех 4 статусов: PENDING_MODERATION / ACTIVE / REJECTED /
 * WITHDRAWN. Client-side фильтр по статусу — backend пагинация без фильтра.
 */

export interface ListMyOffersVariables {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchMyOffers(
  variables: ListMyOffersVariables = {},
): Promise<MarketplaceOfferPage> {
  const { page, limit, sortBy, sortOrder } = variables;
  const { [Queries.Marketplace.ListMyOffers.name]: result } = await client.Query(
    Queries.Marketplace.ListMyOffers.query,
    {
      variables: {
        input: {
          page: page ?? 1,
          limit: limit ?? 50,
          sortBy: sortBy ?? 'updated_at',
          sortOrder: sortOrder ?? 'DESC',
        },
      },
    },
  );
  return result;
}

/**
 * Поставщик возвращает снятое предложение на публикацию (WITHDRAWN →
 * PENDING_MODERATION). Backend: marketplace-offer.resolver.ts →
 * marketplaceRepublishOffer (guard 'Offer' 'update:own'). Снятие не удаляет
 * данные оферты, поэтому пересоздавать ничего не нужно — она снова уходит на
 * модерацию с прежним содержимым.
 */
export async function republishOffer(id: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.RepublishOffer.mutation, {
    variables: { input: { id } },
  });
}
