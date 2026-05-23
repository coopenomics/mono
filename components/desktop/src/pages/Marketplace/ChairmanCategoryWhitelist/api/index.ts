import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 3 / Story 3.x: admin-настройка whitelist'а доступных категорий.
 * Backend Resolver: available-category-admin.resolver.ts → @AuthRoles(['chairman']).
 *
 * Reuse 4 endpoint'а: Get, Stats, Add, Remove. Tree-выбор подключается
 * на следующем шаге (нужен dialog с marketplaceGetCategoryTree).
 */

export type MarketplaceAvailableCategoryView =
  Queries.Marketplace.GetAvailableCategories.IOutput['marketplaceGetAvailableCategories'][number];

export type MarketplaceAvailabilityStatsView =
  Queries.Marketplace.GetAvailabilityStats.IOutput['marketplaceGetAvailabilityStats'];

export async function fetchAvailableCategories(): Promise<MarketplaceAvailableCategoryView[]> {
  const { [Queries.Marketplace.GetAvailableCategories.name]: result } = await client.Query(
    Queries.Marketplace.GetAvailableCategories.query,
    {},
  );
  return result;
}

export async function fetchAvailabilityStats(): Promise<MarketplaceAvailabilityStatsView> {
  const { [Queries.Marketplace.GetAvailabilityStats.name]: result } = await client.Query(
    Queries.Marketplace.GetAvailabilityStats.query,
    {},
  );
  return result;
}

export async function addAvailableCategories(categoryIds: number[]): Promise<void> {
  await client.Mutation(Mutations.Marketplace.AddAvailableCategories.mutation, {
    variables: { input: { categoryIds } },
  });
}

export async function removeAvailableCategories(categoryIds: number[]): Promise<void> {
  await client.Mutation(Mutations.Marketplace.RemoveAvailableCategories.mutation, {
    variables: { input: { categoryIds } },
  });
}
