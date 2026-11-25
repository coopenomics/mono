/**
 * Пакет выплаты поставщику — проекция строки `marketplace::payouts` и её
 * исходящего платежа в gateway (решение владельца 19.11.2026).
 *
 * Обход выплат в конце дня объединяет принятые и ещё не оплаченные заказы поставщика в один
 * пакет: один платёж кассиру вместо платежа на каждый заказ. Запись создаёт
 * обход выплат перед включением заказов в пакет; сумму, удержание и состояние
 * узел берёт из дельты таблицы `payouts` — сумму считает контракт.
 *
 * Поток:
 *   1. обход создаёт запись OPEN и включает заказы (`addpayout`);
 *   2. `sendpayout` регистрирует один исходящий платёж → PENDING, узел заводит
 *      платёж в реестре кассира;
 *   3. gateway::outcomplete → `payconfirm` → COMPLETED, узел закрывает заказы
 *      пакета (`closepayout`, Дт 76 / Кт 51 на заказ);
 *   4. gateway::outdecline → `paydecline` → DECLINED, узел возвращает заказы
 *      (`releasepay`), они попадают в пакет следующего дня.
 */

export type MarketplaceOutgoingPaymentRequestStatus =
  | 'OPEN'
  | 'PENDING'
  | 'COMPLETED'
  | 'DECLINED';

export const MarketplaceOutgoingPaymentRequestStatuses = {
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
} as const satisfies Record<string, MarketplaceOutgoingPaymentRequestStatus>;

/** Состояние строки пакета в цепи (`marketplace::payouts.status`). */
export const MarketplacePayoutChainStatuses = {
  OPEN: 'open',
  SENT: 'sent',
  PAID: 'paid',
  DECLINED: 'declined',
} as const;

/** Состояние цепи → состояние проекции. */
export const PAYOUT_STATUS_BY_CHAIN: Record<string, MarketplaceOutgoingPaymentRequestStatus> = {
  [MarketplacePayoutChainStatuses.OPEN]: MarketplaceOutgoingPaymentRequestStatuses.OPEN,
  [MarketplacePayoutChainStatuses.SENT]: MarketplaceOutgoingPaymentRequestStatuses.PENDING,
  [MarketplacePayoutChainStatuses.PAID]: MarketplaceOutgoingPaymentRequestStatuses.COMPLETED,
  [MarketplacePayoutChainStatuses.DECLINED]: MarketplaceOutgoingPaymentRequestStatuses.DECLINED,
};

/** Заказ в пакете выплаты. */
export interface MarketplaceOutgoingPaymentLine {
  order_id: string;
  order_hash: string;
}

export interface MarketplaceOutgoingPaymentRequestProps {
  id: string;
  coopname: string;
  /** Хэш пакета — хэш строки `payouts` и outcome_hash исходящего платежа в gateway. */
  payment_hash: string;
  /** Заказы пакета. */
  lines: MarketplaceOutgoingPaymentLine[];
  payee_account: string;
  /** Сумма перевода по пакету — из цепи; до включения заказов — 0. */
  amount: string;
  symbol: string;
  purpose: string;
  /** Реквизиты получателя выплаты — маскированные, на момент создания пакета. */
  payout_destination: string | null;
  /** Удержано в счёт признанного гарантийного долга по заказам пакета — из цепи. */
  withheld_amount: string;
  status: MarketplaceOutgoingPaymentRequestStatus;
  /** Заполняется на переходе → COMPLETED. */
  completed_at: Date | null;
  /** Заполняется на переходе → DECLINED. */
  decline_reason: string | null;
  /** Платёж пакета в общем реестре кооператива (его видит кассир). */
  core_payment_id: string | null;
  /** Транзакция подтверждения кассира — для трассировки в журнале. */
  payout_tx_hash: string | null;
  /** Все заказы пакета закрыты (оплачены либо возвращены) — обходу выплат пакет больше не нужен. */
  settled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
