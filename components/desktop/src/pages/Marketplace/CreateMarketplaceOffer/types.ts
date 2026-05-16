/**
 * Story 4.7: типы формы публикации Offer'а с cycle_type.
 *
 * Источник истины — backend `MarketplaceCreateOfferInputDTO`. Ручная
 * типизация — техдолг до регенерации Zeus в `@coopenomics/sdk` (как
 * на других страницах Marketplace).
 */
export type MarketplaceOfferCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter' | 'pack';

export interface MarketplaceCreateOfferFormState {
  product_name: string;
  description: string;
  category_id: number | null;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
}

export interface MarketplaceCreateOfferPayload {
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
}

export interface MarketplaceCategoryView {
  id: number;
  display_name: string;
  sort_order: number;
}

export interface MarketplaceCreateOfferResult {
  id: string;
  status: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
  product_name: string;
  cycle_type: MarketplaceOfferCycleType;
}
