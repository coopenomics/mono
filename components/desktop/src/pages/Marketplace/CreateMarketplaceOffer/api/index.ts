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
 * Редактирование своего предложения. На повторную модерацию уходит только
 * правка карточки имущества (название, описание, категория, единица
 * измерения, фотографии); цена, остаток, упаковки и пункты выдачи меняются
 * без снятия предложения с витрины.
 */
export async function updateOffer(
  payload: MarketplaceUpdateOfferPayload
): Promise<MarketplaceCreateOfferResult> {
  const result = await client.Mutation(Mutations.Marketplace.UpdateOffer.mutation, {
    variables: { input: payload },
  });
  return result[Mutations.Marketplace.UpdateOffer.name] as MarketplaceCreateOfferResult;
}

// Форма публикации показывает только доступные категории (с учётом whitelist'а
// кооператива): общие baseline + собственные категории, минус выключенные.
export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const result = await client.Query(Queries.Marketplace.ListAvailableCategories.query);
  return (result[Queries.Marketplace.ListAvailableCategories.name] ?? []) as MarketplaceCategoryView[];
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

