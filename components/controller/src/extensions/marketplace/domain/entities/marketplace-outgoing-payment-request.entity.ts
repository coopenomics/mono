import type {
  MarketplaceOutgoingPaymentRequestProps,
  MarketplaceOutgoingPaymentRequestStatus,
} from './marketplace-outgoing-payment-request.types';
import { MarketplaceOutgoingPaymentRequestStatuses } from './marketplace-outgoing-payment-request.types';

/**
 * Audit-projection одного outcome'а в gateway::outcomes для marketplace
 * (L12 / 598-16). Жизненный цикл управляется не пользовательскими
 * мутациями, а слушателями blockchain action delta.
 */
export class MarketplaceOutgoingPaymentRequestDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly order_hash: string;
  public readonly order_id: string;
  public readonly apl_reception_id: string;
  public readonly payee_account: string;
  public readonly amount: string;
  public readonly symbol: string;
  public readonly purpose: string;
  public readonly payout_destination: string | null;
  public status: MarketplaceOutgoingPaymentRequestStatus;
  public completed_at: Date | null;
  public decline_reason: string | null;
  public core_payment_id: string | null;
  public payout_tx_hash: string | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceOutgoingPaymentRequestProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.order_hash = props.order_hash;
    this.order_id = props.order_id;
    this.apl_reception_id = props.apl_reception_id;
    this.payee_account = props.payee_account;
    this.amount = props.amount;
    this.symbol = props.symbol;
    this.purpose = props.purpose;
    this.payout_destination = props.payout_destination;
    this.status = props.status;
    this.completed_at = props.completed_at;
    this.decline_reason = props.decline_reason;
    this.core_payment_id = props.core_payment_id;
    this.payout_tx_hash = props.payout_tx_hash;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
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
