import type {
  MarketplaceOutgoingPaymentRequestProps,
  MarketplaceOutgoingPaymentRequestStatus,
} from './marketplace-outgoing-payment-request.types';
import { MarketplaceOutgoingPaymentRequestStatuses } from './marketplace-outgoing-payment-request.types';

/**
 * Story 5.6 / 5.7: запрос исходящего платежа поставщику в кассу кооператива.
 */
export class MarketplaceOutgoingPaymentRequestDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly apl_reception_id: string;
  public readonly payee_account: string;
  public readonly related_order_ids: string[];
  public readonly amount: string;
  public readonly symbol: string;
  public readonly purpose: string;
  public status: MarketplaceOutgoingPaymentRequestStatus;
  public confirmed_at: Date | null;
  public payment_reference: string | null;
  public bank_statement_ref: string | null;
  public blocked_reason: string | null;
  public payout_tx_hash: string | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceOutgoingPaymentRequestProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.apl_reception_id = props.apl_reception_id;
    this.payee_account = props.payee_account;
    this.related_order_ids = props.related_order_ids;
    this.amount = props.amount;
    this.symbol = props.symbol;
    this.purpose = props.purpose;
    this.status = props.status;
    this.confirmed_at = props.confirmed_at;
    this.payment_reference = props.payment_reference;
    this.bank_statement_ref = props.bank_statement_ref;
    this.blocked_reason = props.blocked_reason;
    this.payout_tx_hash = props.payout_tx_hash;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get is_pending_cashier(): boolean {
    return this.status === MarketplaceOutgoingPaymentRequestStatuses.PENDING_CASHIER_ACTION;
  }

  public get is_confirmed(): boolean {
    return (
      this.status === MarketplaceOutgoingPaymentRequestStatuses.CONFIRMED_BY_CASHIER ||
      this.status === MarketplaceOutgoingPaymentRequestStatuses.LEDGER_RECORDED
    );
  }
}
