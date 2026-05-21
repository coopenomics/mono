/**
 * Эпик 3 / Story 3.4: типы offerer-стола «Мои предложения».
 * Источник истины — backend MarketplaceOfferDTO + MarketplaceOfferStatuses.
 */

export type MarketplaceOfferStatusView =
  | 'PENDING_MODERATION'
  | 'ACTIVE'
  | 'REJECTED'
  | 'WITHDRAWN';

export type MarketplaceOfferCycleTypeView =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export interface MarketplaceOfferView {
  id: string;
  coopname: string;
  supplier_account: string;
  vitrine_id: string | null;
  product_name: string;
  description: string | null;
  category_id: string | null;
  price_per_unit: string;
  unit_of_measure: string;
  quantity_available: number;
  quantity_blocked: number;
  quantity_consumed: number;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleTypeView;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
  barcode_strategy: string;
  pack_size: number | null;
  status: MarketplaceOfferStatusView;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOfferPage {
  items: MarketplaceOfferView[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
