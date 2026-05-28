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
 * Эпик 4 / Story 4.2: поставщик вручную запускает поставку по своему
 * предложению с открытой подпиской (cycle_type=open_subscription).
 *
 * Backend Resolver: marketplace-cycle.resolver.ts → marketplaceTriggerOpenSubscription
 * (guard 'Offer' 'update:own'). Нажатие = акцепт всего накопленного пула:
 * сервер формирует сводную заявку status=ACCEPTED и принимает заказы разом.
 * Ошибки backend (пустой пул, не open_subscription, не ACTIVE, чужой Offer)
 * приходят как GraphQL-исключения — пробрасываем их вызывающему компоненту.
 */
export async function triggerOpenSubscription(offer_id: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.TriggerOpenSubscription.mutation, {
    variables: { input: { offer_id } },
  });
}

/**
 * Поставщик снимает своё предложение с публикации (статус → WITHDRAWN).
 * Backend: marketplace-offer.resolver.ts → marketplaceWithdrawOffer
 * (guard 'Offer' 'delete:own', ownership проверяется в сервисе).
 */
export async function withdrawOffer(id: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.WithdrawOffer.mutation, {
    variables: { input: { id } },
  });
}
