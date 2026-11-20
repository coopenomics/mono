import type {
  MarketplaceOutgoingPaymentLine,
  MarketplaceOutgoingPaymentRequestProps,
  MarketplaceOutgoingPaymentRequestStatus,
} from './marketplace-outgoing-payment-request.types';
import { MarketplaceOutgoingPaymentRequestStatuses } from './marketplace-outgoing-payment-request.types';

/**
 * Пакет выплаты поставщику: один платёж кассиру на заказы поставщика за день.
 * Жизненный цикл ведёт обход выплат и слушатели цепи, пользовательских мутаций
 * нет.
 */
export class MarketplaceOutgoingPaymentRequestDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly payment_hash: string;
  public lines: MarketplaceOutgoingPaymentLine[];
  public readonly payee_account: string;
  public amount: string;
  public readonly symbol: string;
  public readonly purpose: string;
  public readonly payout_destination: string | null;
  public withheld_amount: string;
  public status: MarketplaceOutgoingPaymentRequestStatus;
  public completed_at: Date | null;
  public decline_reason: string | null;
  public core_payment_id: string | null;
  public payout_tx_hash: string | null;
  public settled_at: Date | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceOutgoingPaymentRequestProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.payment_hash = props.payment_hash;
    this.lines = props.lines;
    this.payee_account = props.payee_account;
    this.amount = props.amount;
    this.symbol = props.symbol;
    this.purpose = props.purpose;
    this.payout_destination = props.payout_destination;
    this.withheld_amount = props.withheld_amount;
    this.status = props.status;
    this.completed_at = props.completed_at;
    this.decline_reason = props.decline_reason;
    this.core_payment_id = props.core_payment_id;
    this.payout_tx_hash = props.payout_tx_hash;
    this.settled_at = props.settled_at;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get is_open(): boolean {
    return this.status === MarketplaceOutgoingPaymentRequestStatuses.OPEN;
  }

  public get is_pending(): boolean {
    return this.status === MarketplaceOutgoingPaymentRequestStatuses.PENDING;
  }

  public get is_completed(): boolean {
    return this.status === MarketplaceOutgoingPaymentRequestStatuses.COMPLETED;
  }

  public get is_declined(): boolean {
    return this.status === MarketplaceOutgoingPaymentRequestStatuses.DECLINED;
  }
}
