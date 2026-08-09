import type { MarketplaceShipmentTTNData } from './marketplace-shipment.types';
import type { MarketplaceTtnDocumentProps } from './marketplace-ttn-document.types';

export class MarketplaceTtnDocumentDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly shipment_id: string;
  public readonly ttn_number: string;
  public readonly registry_id: number;
  public readonly document_hash: string;
  public readonly content_html: string;
  public readonly meta: Record<string, unknown>;
  public readonly supplier_account: string;
  public readonly accept_braname: string;
  public readonly total_amount: string;
  public readonly currency: string;
  public readonly ttn_data: MarketplaceShipmentTTNData;
  public readonly created_at: Date;
  public readonly updated_at: Date;

  constructor(props: MarketplaceTtnDocumentProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.shipment_id = props.shipment_id;
    this.ttn_number = props.ttn_number;
    this.registry_id = props.registry_id;
    this.document_hash = props.document_hash;
    this.content_html = props.content_html;
    this.meta = props.meta;
    this.supplier_account = props.supplier_account;
    this.accept_braname = props.accept_braname;
    this.total_amount = props.total_amount;
    this.currency = props.currency;
    this.ttn_data = props.ttn_data;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
