import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  CatalogSort,
  MarketplaceCategoryOfferCount,
  MarketplaceCategoryView,
  MarketplaceOfferPage,
} from '../types';

/**
 * Story 3.5: типизированные запросы каталога Стола заказов через SDK Zeus.
 * Все GraphQL-запросы идут через `@coopenomics/sdk` Queries.Marketplace —
 * raw query-строки и `sendPOST('/v1/graphql', ...)` в marketplace запрещены.
 */

export interface ListCatalogVariables {
  category_id?: number | null;
  page?: number;
  limit?: number;
  sort?: CatalogSort;
}

function mapSortToBackend(sort: CatalogSort | undefined): {
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
} {
  switch (sort) {
    case 'price_asc':
      return { sortBy: 'price_per_unit', sortOrder: 'ASC' };
    case 'price_desc':
      return { sortBy: 'price_per_unit', sortOrder: 'DESC' };
    case 'created_at_desc':
    default:
      return { sortBy: 'created_at', sortOrder: 'DESC' };
  }
}

export async function fetchCatalog(
  variables: ListCatalogVariables
): Promise<MarketplaceOfferPage> {
  const { sortBy, sortOrder } = mapSortToBackend(variables.sort);
  const input = {
    category_id: variables.category_id ?? null,
    page: variables.page ?? 1,
    limit: variables.limit ?? 24,
    sortBy,
    sortOrder,
  };
  const result = await client.Query(Queries.Marketplace.ListCatalog.query, {
    variables: { input },
  });
  return result[Queries.Marketplace.ListCatalog.name] as MarketplaceOfferPage;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const result = await client.Query(Queries.Marketplace.ListCategories.query);
  return (result[Queries.Marketplace.ListCategories.name] ?? []) as MarketplaceCategoryView[];
}

export async function fetchCategoryOfferCounts(): Promise<MarketplaceCategoryOfferCount[]> {
  const result = await client.Query(Queries.Marketplace.CategoryOfferCounts.query);
  return (result[Queries.Marketplace.CategoryOfferCounts.name] ?? []) as MarketplaceCategoryOfferCount[];
}
