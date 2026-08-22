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
  // Эпик 16 / Story 16.3: пункт выдачи (КУ). Если задан — каталог показывает
  // только товары, доставимые на этот КУ. null/undefined — без КУ-фильтра.
  delivery_braname?: string | null;
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
    delivery_braname: variables.delivery_braname ?? null,
  };
  const { [Queries.Marketplace.ListCatalog.name]: page } = await client.Query(
    Queries.Marketplace.ListCatalog.query,
    { variables: { input } },
  );
  return page;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const { [Queries.Marketplace.ListCategories.name]: list } = await client.Query(
    Queries.Marketplace.ListCategories.query,
  );
  return list;
}

export async function fetchCategoryOfferCounts(
  delivery_braname?: string | null,
): Promise<MarketplaceCategoryOfferCount[]> {
  const { [Queries.Marketplace.CategoryOfferCounts.name]: list } = await client.Query(
    Queries.Marketplace.CategoryOfferCounts.query,
    { variables: { delivery_braname: delivery_braname ?? null } },
  );
  return list;
}
