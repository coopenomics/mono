import type {
  MarketplaceConsolidatedRequestProps,
  MarketplaceConsolidatedRequestStatus,
} from './marketplace-consolidated-request.types';

/**
 * Story 4.2 (ревизия Эпик 15): домен партии-накопителя. Backend-only (Locked
 * Decision L10): on-chain представления НЕТ. Партия формируется в момент
 * batch-accept поставщиком из выбранных заказов (offer × КУ); агрегация
 * целиком в PG.
 *
 * Order'ы связаны через `marketplace_order.cycle_id = consolidated_request.id`.
 * Терминальный переход → Order'ы внутри получают соответствующий status
 * (см. Story 4.5 supplier accept/decline и Story 4.3 expire-handlers).
 */
export class MarketplaceConsolidatedRequestDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly offer_id: string;
  public readonly supplier_account: string;
  public readonly total_quantity: number;
  public readonly total_amount: string;
  public status: MarketplaceConsolidatedRequestStatus;
  public readonly cycle_started_at: Date;
  public readonly cycle_ended_at: Date | null;
  public readonly expires_at: Date | null;
  public accepted_at: Date | null;
  public declined_at: Date | null;
  public decline_reason: string | null;
  public readonly triggered_by_supplier_at: Date | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceConsolidatedRequestProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.offer_id = props.offer_id;
    this.supplier_account = props.supplier_account;
    this.total_quantity = props.total_quantity;
    this.total_amount = props.total_amount;
    this.status = props.status;
    this.cycle_started_at = props.cycle_started_at;
    this.cycle_ended_at = props.cycle_ended_at;
    this.expires_at = props.expires_at;
    this.accepted_at = props.accepted_at;
    this.declined_at = props.declined_at;
    this.decline_reason = props.decline_reason;
    this.triggered_by_supplier_at = props.triggered_by_supplier_at;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get is_pending(): boolean {
    return this.status === 'PENDING_SUPPLIER_ACCEPT';
  }

  public get is_terminal(): boolean {
    return (
      this.status === 'ACCEPTED' ||
      this.status === 'DECLINED_BY_SUPPLIER' ||
      this.status === 'EXPIRED_NO_RESPONSE'
    );
  }
}
