/**
 * Story 4.1: тип цикла отсечки Offer'а (Locked Decision L11). Копируется
 * в Order при создании (snapshot времени публикации Offer'а).
 *
 *  - `time_based`         — поставка по истечении `cycle_days` (если набрано
 *                           >= `min_threshold`).
 *  - `volume_based`       — поставка стартует когда набран `target_volume`
 *                           или истёк `max_wait_days`.
 *  - `open_subscription`  — поставщик жмёт «Запустить» вручную, без cycle_end.
 *  - `individual`         — без агрегации, поставщик принимает per-Order.
 */
export type MarketplaceOrderCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

/**
 * Жизненный цикл Order'а p.mkt.supply. Зеркало enum on-chain
 * (`marketplace::orders.status`), плюс backend-only поля для cycle-агрегации.
 *
 * Финальные «отменённые» статусы — серая зона; backend сохраняет их с reason
 * (см. `marketplace_order.last_status_reason`).
 */
export type MarketplaceOrderStatus =
  // ── Активный: средства заблокированы, поставщик/цикл ещё не отреагировали.
  | 'ACTIVE'
  // ── Время/объём набран, ждём акцепт батча от поставщика (time/volume).
  | 'ACCEPTED_PENDING_SUPPLIER'
  // ── individual cycle: ждём акцепт поставщика per-Order.
  | 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'
  // ── Поставщик принял (любой cycle_type).
  | 'ACCEPTED'
  // ── Поставщик подготовил поставку первой подписью АПП-приёмки (Story 5.3).
  | 'SUPPLY_PREPARED'
  // ── Председатель принял на КУ закрывающей подписью (Story 5.4).
  | 'ACCEPTED_TO_COOP'
  // ── КУ выдачи готов выдать пайщику (Story 6.1).
  | 'READY_TO_RECEIVE'
  // ── Пайщик получил, гарантия идёт (Story 6.3).
  | 'RECEIVED'
  // ── Гарантийный возврат принят (Story 7.4).
  | 'RETURNED'
  // ── Отменён заказчиком до acceptance.
  | 'CANCELLED_BY_ORDERER'
  // ── Отменён поставщиком (decline batch / decline individual).
  | 'CANCELLED_BY_SUPPLIER'
  // ── Time-based цикл закрыт без достижения min_threshold.
  | 'EXPIRED_NO_THRESHOLD'
  // ── Volume-based цикл закрыт без достижения target_volume.
  | 'EXPIRED_NO_VOLUME';

/**
 * Снапшот ledger2 транзакции `createorder` (3-step atomic series) для
 * аудита и UI WalletTimeline. Хранится в `marketplace_order.create_tx`.
 */
export interface MarketplaceOrderCreateTxSnapshot {
  /** tx_hash транзакции Antelope (для cross-reference в журнале). */
  tx_hash: string;
  /** Block number применения. */
  block_num: number;
  /** Был ли выполнен `o.wal.conv` (если у заказчика хватало членского). */
  did_convert: boolean;
  /** Был ли выполнен `o.mkt.assign` (если в программе уже было available). */
  did_assign: boolean;
  /** Сумма BLOCK на `w.mkt.member` пайщика (= total_cost Order'а). */
  blocked_amount: string;
  /** ISO timestamp. */
  signed_at: string;
}

export interface MarketplaceOrderProps {
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
  cycle_type: MarketplaceOrderCycleType;
  cycle_id: string | null;
  warranty_period_secs: number;
  warranty_until: Date | null;
  status: MarketplaceOrderStatus;
  last_status_reason: string | null;
  blocked_at: Date | null;
  accepted_at: Date | null;
  received_at: Date | null;
  cancelled_at: Date | null;
  create_tx: MarketplaceOrderCreateTxSnapshot | null;
  on_chain_id: string | null;
  on_chain_block_num: number | null;
  on_chain_present: boolean;
  created_at: Date;
  updated_at: Date;
}
