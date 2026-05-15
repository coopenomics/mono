/**
 * Story 4.6: типы orderer-стола «Мои заказы».
 * Источник истины — backend MarketplaceOrderDTO / Story 4.1/4.4 mutations.
 * Ручная типизация — техдолг до регенерации Zeus в `@coopenomics/sdk`.
 */
export type MarketplaceOrderStatusView =
  | 'ACTIVE'
  | 'ACCEPTED_PENDING_SUPPLIER'
  | 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'
  | 'ACCEPTED'
  | 'SUPPLY_PREPARED'
  | 'ACCEPTED_TO_COOP'
  | 'READY_TO_RECEIVE'
  | 'RECEIVED'
  | 'RETURNED'
  | 'CANCELLED_BY_ORDERER'
  | 'CANCELLED_BY_SUPPLIER'
  | 'EXPIRED_NO_THRESHOLD'
  | 'EXPIRED_NO_VOLUME';

export type MarketplaceOrderCycleTypeView =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export interface MarketplaceOrderView {
  id: string;
  coopname: string;
  order_hash: string;
  orderer_account: string;
  offer_id: string;
  offer_hash: string;
  supplier_account: string;
  delivery_braname: string;
  quantity: number;
  price_per_unit: string;
  total_cost: string;
  cycle_type: MarketplaceOrderCycleTypeView;
  cycle_id: string | null;
  warranty_period_secs: number;
  warranty_until: string | null;
  status: MarketplaceOrderStatusView;
  last_status_reason: string | null;
  blocked_at: string | null;
  accepted_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrderPage {
  items: MarketplaceOrderView[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
