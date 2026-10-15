import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';

/**
 * Story 5.6 / 5.7 + 598-16 (L12): per-Order projection одного outcome'а
 * gateway::outcomes для marketplace UI поставщика. Жизненный цикл —
 * слушатели blockchain action delta (payout / payconfirm / paydecline).
 *
 * Hot-path индексы:
 *   - `(coopname, order_hash)` unique — один Order = одна запись;
 *   - `(coopname, apl_reception_id)` — N записей на одну АПП группы;
 *   - `(coopname, payee_account, status)` — лента истории выплат поставщику.
 */
export class MarketplaceOutgoingPaymentRequestEntity {
  public id!: string;

  public coopname!: string;

  public order_hash!: string;

  public order_id!: string;

  public apl_reception_id!: string;

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

  public created_at!: Date;

  public updated_at!: Date;
}
