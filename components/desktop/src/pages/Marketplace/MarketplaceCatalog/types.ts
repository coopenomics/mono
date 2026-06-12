/**
 * Story 3.5: типы каталога Стола заказов — берутся из SDK Zeus IOutput
 * соответствующих query, чтобы избежать ручного дублирования backend-схемы.
 */
import type { Queries } from '@coopenomics/sdk';

export type MarketplaceOfferPage =
  Queries.Marketplace.ListCatalog.IOutput['marketplaceListCatalog'];

export type MarketplaceOfferView = MarketplaceOfferPage['items'][number];

export type MarketplaceCategoryView =
  Queries.Marketplace.ListCategories.IOutput['marketplaceListCategories'][number];

export type MarketplaceCategoryOfferCount =
  Queries.Marketplace.CategoryOfferCounts.IOutput['marketplaceCategoryOfferCounts'][number];

export interface BranchOption {
  braname: string;
  short_name: string;
  city: string | null;
}

export type CatalogSort = 'created_at_desc' | 'price_asc' | 'price_desc';

export interface CatalogFilter {
  category_id: number | null;
  sort: CatalogSort;
}
