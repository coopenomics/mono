/**
 * Story 5.6 / 5.7 + E11 техдолг 598-16 (Locked Decision L12):
 *
 * Audit-projection одного outcome'а в gateway::outcomes для расширения
 * marketplace. По канону L12 «один Order → один outcome в gateway →
 * одна запись здесь», `order_hash` совпадает с `outcomes.outcome_hash`.
 * Кассир работает в общем столе gateway (не в marketplace), backend
 * marketplace только слушает blockchain-action delta для трёх ключевых
 * переходов и зеркалит их статусы для UI marketplace-стола поставщика.
 *
 * Поток:
 *   1. backend `marketplace::payout` → запись создаётся в статусе PENDING
 *      (listener на action::marketplace::payout).
 *   2. gateway::outcomplete inline-вызывает `marketplace::payconfirm` →
 *      listener переводит статус в COMPLETED, фиксирует core_payment_id.
 *   3. gateway::outdecline inline-вызывает `marketplace::paydecline` →
 *      listener переводит статус в DECLINED, сохраняет `decline_reason`.
 */

export type MarketplaceOutgoingPaymentRequestStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'DECLINED';

export const MarketplaceOutgoingPaymentRequestStatuses = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
} as const satisfies Record<string, MarketplaceOutgoingPaymentRequestStatus>;

export interface MarketplaceOutgoingPaymentRequestProps {
  id: string;
  coopname: string;
  /** Хэш Order'а — совпадает с outcome_hash в gateway::outcomes (L12). */
  order_hash: string;
  /** UUID Order'а в marketplace_order — для join'ов в queries. */
  order_id: string;
  apl_reception_id: string;
  payee_account: string;
  amount: string;
  symbol: string;
  purpose: string;
  /** Куда уходит выплата — маскированные реквизиты на момент создания. */
  payout_destination: string | null;
  status: MarketplaceOutgoingPaymentRequestStatus;
  /** Заполняется на переходе → COMPLETED. */
  completed_at: Date | null;
  /** Заполняется на переходе → DECLINED. */
  decline_reason: string | null;
  /** Story 598-17 / AR35: id связанного платежа в core-реестре `payments`. */
  core_payment_id: string | null;
  /** Hash транзакции payOut / payConfirm — для трассировки в логах. */
  payout_tx_hash: string | null;
  created_at: Date;
  updated_at: Date;
}
