import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  BranchOption,
  CatalogSort,
  MarketplaceCategoryOfferCount,
  MarketplaceCategoryView,
  MarketplaceOfferPage,
  MarketplaceOrderCreated,
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

export async function fetchCategoryOfferCounts(): Promise<MarketplaceCategoryOfferCount[]> {
  const { [Queries.Marketplace.CategoryOfferCounts.name]: list } = await client.Query(
    Queries.Marketplace.CategoryOfferCounts.query,
  );
  return list;
}

export async function fetchBranchOptions(coopname: string): Promise<BranchOption[]> {
  const { [Queries.Branches.GetBranches.name]: list } = await client.Query(
    Queries.Branches.GetBranches.query,
    { variables: { data: { coopname, braname: null } } },
  );
  return (list ?? []).map((b) => ({
    braname: b.braname,
    short_name: b.short_name ?? b.full_name ?? b.braname,
    city: b.city ?? null,
  }));
}

export async function submitCreateOrder(input: {
  offer_id: string;
  quantity: number;
  delivery_braname: string;
}): Promise<MarketplaceOrderCreated> {
  const { [Mutations.Marketplace.CreateOrder.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateOrder.mutation,
    { variables: { input } },
  );
  return result;
}
