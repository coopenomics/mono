export type MarketplaceOrderCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export const MarketplaceOrderCycleTypes = {
  TIME_BASED: 'time_based',
  VOLUME_BASED: 'volume_based',
  OPEN_SUBSCRIPTION: 'open_subscription',
  INDIVIDUAL: 'individual',
} as const satisfies Record<string, MarketplaceOrderCycleType>;

export type MarketplaceOrderStatus =
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

export const MarketplaceOrderStatuses = {
  ACTIVE: 'ACTIVE',
  ACCEPTED_PENDING_SUPPLIER: 'ACCEPTED_PENDING_SUPPLIER',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
  ACCEPTED: 'ACCEPTED',
  SUPPLY_PREPARED: 'SUPPLY_PREPARED',
  ACCEPTED_TO_COOP: 'ACCEPTED_TO_COOP',
  READY_TO_RECEIVE: 'READY_TO_RECEIVE',
  RECEIVED: 'RECEIVED',
  RETURNED: 'RETURNED',
  CANCELLED_BY_ORDERER: 'CANCELLED_BY_ORDERER',
  CANCELLED_BY_SUPPLIER: 'CANCELLED_BY_SUPPLIER',
  EXPIRED_NO_THRESHOLD: 'EXPIRED_NO_THRESHOLD',
  EXPIRED_NO_VOLUME: 'EXPIRED_NO_VOLUME',
} as const satisfies Record<string, MarketplaceOrderStatus>;

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
