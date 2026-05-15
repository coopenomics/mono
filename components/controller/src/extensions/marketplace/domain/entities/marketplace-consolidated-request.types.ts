import type { MarketplaceOrderCycleType } from './marketplace-order.types';

/**
 * Story 4.2: жизненный цикл консолидированной заявки `marketplace_consolidated_request`.
 *
 *  - `PENDING_SUPPLIER_ACCEPT` — заявка сформирована (time-based / volume-based),
 *    ждём accept/decline поставщика в течение `acceptance_window_hours`.
 *  - `ACCEPTED` — поставщик акцептовал (или open_subscription триггернут самим
 *    поставщиком). Order'ы внутри переходят в `ACCEPTED` (Story 4.5).
 *  - `DECLINED_BY_SUPPLIER` — поставщик отказался; Order'ы внутри получают
 *    o.mkt.unblk + status `CANCELLED_BY_SUPPLIER` (Story 4.5).
 *  - `EXPIRED_NO_RESPONSE` — `expires_at` истёк без ответа поставщика →
 *    auto-decline в Story 4.3.
 *  - `EXPIRED_NO_THRESHOLD` (time_based) / `EXPIRED_NO_VOLUME` (volume_based) —
 *    цикл закрыт до формирования заявки; Story 4.3 unblk per-Order'ам пула.
 *    Записывается как terminal `marketplace_consolidated_request` без
 *    Order'ов (для audit-trail), либо вовсе не создаётся — решение в pre-aggregator.
 */
export type MarketplaceConsolidatedRequestStatus =
  | 'PENDING_SUPPLIER_ACCEPT'
  | 'ACCEPTED'
  | 'DECLINED_BY_SUPPLIER'
  | 'EXPIRED_NO_RESPONSE'
  | 'EXPIRED_NO_THRESHOLD'
  | 'EXPIRED_NO_VOLUME';

export interface MarketplaceConsolidatedRequestProps {
  id: string;
  coopname: string;
  offer_id: string;
  supplier_account: string;
  cycle_type: MarketplaceOrderCycleType;
  total_quantity: number;
  total_amount: string;
  status: MarketplaceConsolidatedRequestStatus;
  cycle_started_at: Date;
  cycle_ended_at: Date | null;
  expires_at: Date | null;
  accepted_at: Date | null;
  declined_at: Date | null;
  decline_reason: string | null;
  triggered_by_supplier_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
