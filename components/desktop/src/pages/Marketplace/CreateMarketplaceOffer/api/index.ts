import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferPayload,
  MarketplaceCreateOfferResult,
  MarketplaceOfferEditPrefill,
  MarketplaceUpdateOfferPayload,
} from '../types';

export async function createOffer(
  payload: MarketplaceCreateOfferPayload
): Promise<MarketplaceCreateOfferResult> {
  const result = await client.Mutation(Mutations.Marketplace.CreateOffer.mutation, {
    variables: { input: payload },
  });
  return result[Mutations.Marketplace.CreateOffer.name] as MarketplaceCreateOfferResult;
}

/**
 * Редактирование своего предложения. Backend marketplaceUpdateOffer
 * сбрасывает статус в PENDING_MODERATION — правка уходит на повторную
 * модерацию в рамках того же предложения.
 */
export async function updateOffer(
  payload: MarketplaceUpdateOfferPayload
): Promise<MarketplaceCreateOfferResult> {
  const result = await client.Mutation(Mutations.Marketplace.UpdateOffer.mutation, {
    variables: { input: payload },
  });
  return result[Mutations.Marketplace.UpdateOffer.name] as MarketplaceCreateOfferResult;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const result = await client.Query(Queries.Marketplace.ListCategories.query);
  return (result[Queries.Marketplace.ListCategories.name] ?? []) as MarketplaceCategoryView[];
}

/**
 * Загружает текущее состояние предложения для префилла формы редактирования.
 * Отдельного getOffer на бэке нет — берём из собственного списка предложений
 * поставщика (marketplaceListMyOffers) и находим по id. Список — только свои
 * предложения, поэтому чужое отредактировать через эту форму нельзя.
 */
export async function fetchMyOfferById(
  id: string
): Promise<MarketplaceOfferEditPrefill | null> {
  const result = await client.Query(Queries.Marketplace.ListMyOffers.query, {
    variables: { input: { page: 1, limit: 500, sortBy: 'updated_at', sortOrder: 'DESC' } },
  });
  const page = result[Queries.Marketplace.ListMyOffers.name] as unknown as {
    items: MarketplaceOfferEditPrefill[];
  };
  return page.items.find((o) => o.id === id) ?? null;
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
