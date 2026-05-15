/**
 * Story 3.5: типы каталога Стола заказов.
 * Источник истины — backend `MarketplaceOfferDTO` / `MarketplaceCategoryDTO`.
 * Ручная типизация — техдолг до регенерации Zeus в `@coopenomics/sdk`
 * (см. PR #381 marketplace KU details — там же временно raw GraphQL,
 * пока Zeus не подтянул новые типы).
 */
export interface MarketplaceOfferView {
  id: string;
  cooperative_id: string;
  supplier_account: string;
  vitrine_id: string;
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: 'piece' | 'kg' | 'liter' | 'pack';
  quantity_available: number;
  quantity_blocked: number;
  quantity_consumed: number;
  unlimited_flag: boolean;
  cycle_type: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
  status: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOfferPage {
  total: number;
  items: MarketplaceOfferView[];
}

export interface MarketplaceCategoryView {
  id: number;
  display_name: string;
  sort_order: number;
}

export interface MarketplaceCategoryOfferCount {
  category_id: number;
  count: number;
}

export type CatalogSort = 'created_at_desc' | 'price_asc' | 'price_desc';

export interface CatalogFilter {
  category_id: number | null;
  sort: CatalogSort;
}
