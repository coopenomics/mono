/**
 * Story 5.6 / 5.7: типы запроса исходящего платежа поставщику.
 *
 * Locked Decision L12: payout-операция в ledger lazy — выполняется только
 * после подтверждения кассиром факта банковского перевода. Этот запрос —
 * marketplace-scoped trail; синхронизация с core-реестром исходящих
 * платежей (AR35) подключается отдельным follow-up'ом со связкой
 * core/gateway.
 *
 * MVP-замечание: текущий C++ контракт marketplace::signchair выполняет
 * композитную пару `o.mkt.purch + o.mkt.payout` атомарно (pre-L12
 * поведение). Для соответствия L12 (lazy payout) требуется доработка
 * C++ контракта — техдолг PRD/FR57. Здесь backend ведёт реестр запросов
 * на оплату чтобы кассир имел задачу-handle вне зависимости от того,
 * выполнен payout в ledger или нет.
 */

export type MarketplaceOutgoingPaymentRequestStatus =
  | 'PENDING_CASHIER_ACTION'
  | 'CONFIRMED_BY_CASHIER'
  | 'LEDGER_RECORDED'
  | 'BLOCKED';

export const MarketplaceOutgoingPaymentRequestStatuses = {
  PENDING_CASHIER_ACTION: 'PENDING_CASHIER_ACTION',
  CONFIRMED_BY_CASHIER: 'CONFIRMED_BY_CASHIER',
  LEDGER_RECORDED: 'LEDGER_RECORDED',
  BLOCKED: 'BLOCKED',
} as const satisfies Record<string, MarketplaceOutgoingPaymentRequestStatus>;

export interface MarketplaceOutgoingPaymentRequestProps {
  id: string;
  coopname: string;
  apl_reception_id: string;
  payee_account: string;
  related_order_ids: string[];
  amount: string;
  symbol: string;
  purpose: string;
  status: MarketplaceOutgoingPaymentRequestStatus;
  confirmed_at: Date | null;
  payment_reference: string | null;
  bank_statement_ref: string | null;
  blocked_reason: string | null;
  payout_tx_hash: string | null;
  /**
   * Story 598-17 / AR35: id связанного платежа в core-реестре `payments`.
   * NULL — если синхронизация ещё не выполнена или core-вызов упал.
   */
  core_payment_id: string | null;
  created_at: Date;
  updated_at: Date;
}
