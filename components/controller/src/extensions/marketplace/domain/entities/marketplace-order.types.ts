import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceUnitOfMeasure } from './marketplace-offer.types';

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
  | 'CANCELLED_BY_SUPPLIER';

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
} as const satisfies Record<string, MarketplaceOrderStatus>;

/**
 * Порядок forward-перехода по линейной части state-machine. Backend и
 * цепь обновляют status асинхронно: backend выставляет
 * `ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL` сразу после submit'а createorder
 * (cycle-hook), а delta от парсера приходит с `ACTIVE` — оригинальное
 * состояние on-chain row. Чтобы синхронизация не «откатывала» backend
 * forward в обратную сторону, sync применяет incoming status только
 * если его ранг ≥ текущего (см. `updateFromBlockchain`).
 *
 * Терминальные ветки (CANCELLED_*, RETURNED) отмечены
 * отдельным флагом `MARKETPLACE_ORDER_STATUS_TERMINAL` — они могут
 * прийти с цепи из любого forward-состояния и должны быть применены.
 */
export const MARKETPLACE_ORDER_STATUS_RANK: Record<MarketplaceOrderStatus, number> = {
  ACTIVE: 0,
  ACCEPTED_PENDING_SUPPLIER: 1,
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 1,
  ACCEPTED: 2,
  SUPPLY_PREPARED: 3,
  ACCEPTED_TO_COOP: 4,
  READY_TO_RECEIVE: 5,
  RECEIVED: 6,
  RETURNED: 7,
  CANCELLED_BY_ORDERER: 99,
  CANCELLED_BY_SUPPLIER: 99,
};

export const MARKETPLACE_ORDER_STATUS_TERMINAL: ReadonlySet<MarketplaceOrderStatus> = new Set([
  'RECEIVED',
  'RETURNED',
  'CANCELLED_BY_ORDERER',
  'CANCELLED_BY_SUPPLIER',
]);

/**
 * Снапшот ledger2 транзакции `createorder` (3-step atomic series) для
 * аудита и UI WalletTimeline. Хранится в `marketplace_order.create_tx`.
 */
export interface MarketplaceOrderCreateTxSnapshot {
  /** tx_hash транзакции Antelope (для cross-reference в журнале). */
  tx_hash: string;
  /** Block number применения. */
  block_num: number;
  /** Сумма резерва на `w.mkt.order` пайщика (= total_cost Order'а). */
  locked_amount: string;
  /** ISO timestamp. */
  signed_at: string;
}

/**
 * Снапшот фактической выдачи имущества пайщику после `signiss2`. Хранит
 * сверку «факт vs заказ» и итоговую корреспонденцию для аудита и UI
 * карточки заказа в статусе RECEIVED.
 */
export interface MarketplaceOrderIssuanceFactSnapshot {
  /** Фактически выданное количество единиц. */
  actual_quantity: number;
  /** Фактическая цена за единицу (скорректирована оператором при открытии выдачи). */
  fact_unit_price: string;
  /** Фактическая стоимость выдачи (= actual_quantity × fact_unit_price). */
  fact_cost: string;
  /** Соотношение факта и заказа по стоимости: equal / less / more (см. FR23). */
  diff_state: 'equal' | 'less' | 'more';
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
  unit_of_measure: MarketplaceUnitOfMeasure;
  price_per_unit: string;
  /** Содержимое упаковки в базовой единице (Эпик 18); 0 = отпуск по мере. */
  package_size: number;
  total_cost: string;
  /**
   * Членский взнос, включённый в стоимость заказа (requirement b6). On-chain
   * mirror — контракт сам считает его при `createorder` по ставке на момент
   * заказа; backend не пересчитывает. Null до первой sync-дельты (см.
   * `MarketplaceOrderDomainEntity.updateFromBlockchain`) и у заказов,
   * созданных до появления поля на контракте (`binary_extension`).
   */
  membership_fee: string | null;
  cycle_id: string | null;
  /** Грань «заказ заказчика» (Эпик 16): общий id строк одного оформления на один КУ; null = legacy покарточный заказ. */
  checkout_id: string | null;
  /** Партия, в которую заказ включён при формировании (null = вне партии). */
  shipment_id: string | null;
  warranty_period_secs: number;
  warranty_until: Date | null;
  status: MarketplaceOrderStatus;
  last_status_reason: string | null;
  blocked_at: Date | null;
  accepted_at: Date | null;
  received_at: Date | null;
  cancelled_at: Date | null;
  create_tx: MarketplaceOrderCreateTxSnapshot | null;
  /** ПВЗ, на котором имущество фактически лежит к моменту выдачи. */
  current_warehouse_braname: string | null;
  /** Снапшот фактической выдачи — заполняется в момент `signiss2`. */
  issuance_fact: MarketplaceOrderIssuanceFactSnapshot | null;
  /**
   * Момент, когда оператор КУ выдачи вручную объявил заказ готовым к выдаче
   * («Объявить выдачу» на столе ПВЗ). Backend-only операционный сигнал —
   * on-chain статус не меняется (остаётся ACCEPTED_TO_COOP), проводок нет.
   * Именно он, а не приём в кооператив, шлёт заказчику push «приходите
   * заберите» и включает бейдж «Готово к выдаче» в его кабинете. null — ещё
   * не объявлено.
   */
  ready_announced_at: Date | null;
  /** Время первой подписи (председатель КУ выдачи открыл выдачу — `signiss1`). */
  chairman_signed_at: Date | null;
  /** Backend account, открывший выдачу первой подписью. */
  chairman_account: string | null;
  /** tx_hash on-chain транзакции `signiss1`. */
  signiss1_tx_hash: string | null;
  /**
   * Документ акта выдачи, подписанный председателем при открытии выдачи
   * (`signiss1`). Заказчик получает его как DocumentAggregate и накладывает
   * вторую подпись поверх — backend цепь не читает (канон двухподписного акта).
   */
  issue_act_signiss1_document: ISignedDocument | null;
  /** Время финальной подписи заказчика (получение имущества — `signiss2`). */
  orderer_signed_at: Date | null;
  /** Backend account стороны кооператива при `signiss2` (председатель/доверенный). */
  delivery_signer_account: string | null;
  /** tx_hash on-chain транзакции `signiss2`. */
  signiss2_tx_hash: string | null;
  on_chain_id: string | null;
  on_chain_block_num: number | null;
  on_chain_present: boolean;
  created_at: Date;
  updated_at: Date;
}
