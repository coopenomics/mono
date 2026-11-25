import type {
  MarketplaceOutgoingPaymentLine,
  MarketplaceOutgoingPaymentRequestStatus,
} from '../../domain/entities/marketplace-outgoing-payment-request.types';

/**
 * Пакет выплаты поставщику (решение владельца 19.11.2026): проекция строки
 * `marketplace::payouts` и её исходящего платежа в gateway.
 *
 * Индексы:
 *   - `(coopname, payment_hash)` unique — один пакет = одна запись;
 *   - `(coopname, payee_account, status)` — лента выплат поставщику.
 */
export class MarketplaceOutgoingPaymentRequestEntity {
  public id!: string;

  public coopname!: string;

  /** Хэш пакета выплаты — хэш строки `payouts` и outcome_hash в gateway. */
  public payment_hash!: string;

  /** Заказы пакета: [{ order_id, order_hash }]. */
  public lines!: MarketplaceOutgoingPaymentLine[];

  public payee_account!: string;

  public amount!: string;

  public symbol!: string;

  public purpose!: string;

  /** Маскированная подпись реквизитов получателя, например «Сбербанк •1234». */
  public payout_destination!: string | null;

  /** Удержано в счёт признанного гарантийного долга поставщика (99D-13); `amount` — сумма к переводу. */
  public withheld_amount!: string;

  public status!: MarketplaceOutgoingPaymentRequestStatus;

  public completed_at!: Date | null;

  public decline_reason!: string | null;

  public core_payment_id!: string | null;

  public payout_tx_hash!: string | null;

  /** Все заказы пакета закрыты. */
  public settled_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
