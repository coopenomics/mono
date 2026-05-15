import { sendPOST } from 'src/shared/api/axios';
import type {
  CatalogSort,
  MarketplaceCategoryOfferCount,
  MarketplaceCategoryView,
  MarketplaceOfferPage,
} from '../types';

/**
 * Story 3.5: raw GraphQL к marketplace-backend.
 *
 * Техдолг: после `pnpm cooptypes:gen-zeus` (регенерация Zeus в
 * `@coopenomics/sdk`) переписать на типизированные
 * `Queries.Marketplace.ListCatalog` / `CategoryOfferCounts` /
 * `ListCategories` — см. паттерн `entities/MarketplaceKUDetails` после
 * 2-го коммита refactor в PR #381.
 *
 * До тех пор используем `sendPOST('/v1/graphql', { query, variables })`,
 * без типов schema.gql на клиенте.
 */

const LIST_CATALOG_QUERY = `
  query MarketplaceListCatalog($input: MarketplaceListCatalogInput) {
    marketplaceListCatalog(input: $input) {
      total
      items {
        id
        cooperative_id
        supplier_account
        vitrine_id
        product_name
        description
        category_id
        price_per_unit
        unit_of_measure
        quantity_available
        quantity_blocked
        quantity_consumed
        unlimited_flag
        cycle_type
        cycle_days
        target_volume
        max_wait_days
        min_threshold
        warranty_days
        status
        created_at
        updated_at
      }
    }
  }
`;

const LIST_CATEGORIES_QUERY = `
  query MarketplaceListCategories {
    marketplaceListCategories {
      id
      display_name
      sort_order
    }
  }
`;

const CATEGORY_COUNTS_QUERY = `
  query MarketplaceCategoryOfferCounts {
    marketplaceCategoryOfferCounts {
      category_id
      count
    }
  }
`;

export interface ListCatalogVariables {
  category_id?: number | null;
  limit?: number;
  offset?: number;
  sort?: CatalogSort;
}

export async function fetchCatalog(
  variables: ListCatalogVariables
): Promise<MarketplaceOfferPage> {
  const body = await sendPOST('/v1/graphql', {
    query: LIST_CATALOG_QUERY,
    variables: { input: variables },
  });
  if (body?.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data.marketplaceListCatalog;
}

export async function fetchCategories(): Promise<MarketplaceCategoryView[]> {
  const body = await sendPOST('/v1/graphql', { query: LIST_CATEGORIES_QUERY });
  if (body?.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data.marketplaceListCategories;
}

export async function fetchCategoryOfferCounts(): Promise<MarketplaceCategoryOfferCount[]> {
  const body = await sendPOST('/v1/graphql', { query: CATEGORY_COUNTS_QUERY });
  if (body?.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data.marketplaceCategoryOfferCounts;
}
