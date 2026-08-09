import type {
  MarketplaceAplReceptionExpeditorData,
  MarketplaceAplReceptionFactQuantityEntry,
  MarketplaceAplReceptionProps,
  MarketplaceAplReceptionStatus,
  MarketplaceAplReceptionVariant,
} from './marketplace-apl-reception.types';
import { MarketplaceAplReceptionStatuses } from './marketplace-apl-reception.types';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Story 5.3 / 5.4: домен АПП приёмки. Backend-only state machine; on-chain
 * представления АПП как единого объекта нет — фиксация идёт per-Order
 * через `signsupp` / `signchair` в `agreements` ledger2.
 */
export class MarketplaceAplReceptionDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly shipment_id: string;
  public readonly cycle_id: string;
  public readonly braname: string;
  public readonly offerer_account: string;
  public readonly variant: MarketplaceAplReceptionVariant;
  public status: MarketplaceAplReceptionStatus;
  public readonly fact_quantity_per_order: MarketplaceAplReceptionFactQuantityEntry[];
  public readonly ttn_number: string | null;
  public readonly expeditor_data: MarketplaceAplReceptionExpeditorData | null;
  public readonly created_by_operator_account: string;
  public supplier_signed_at: Date | null;
  public supplier_signsupp_tx_hash: string | null;
  public supplier_signed_documents: ISignedDocumentDomainInterface[] | null;
  public chairman_signed_at: Date | null;
  public chairman_account: string | null;
  public chairman_signchair_tx_hash: string | null;
  public readonly total_amount: string;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceAplReceptionProps) {
    if (!props.id || !props.coopname || !props.shipment_id || !props.braname) {
      throw new Error('MarketplaceAplReceptionDomainEntity: обязательные поля отсутствуют.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.shipment_id = props.shipment_id;
    this.cycle_id = props.cycle_id;
    this.braname = props.braname;
    this.offerer_account = props.offerer_account;
    this.variant = props.variant;
    this.status = props.status;
    this.fact_quantity_per_order = props.fact_quantity_per_order;
    this.ttn_number = props.ttn_number;
    this.expeditor_data = props.expeditor_data;
    this.created_by_operator_account = props.created_by_operator_account;
    this.supplier_signed_at = props.supplier_signed_at;
    this.supplier_signsupp_tx_hash = props.supplier_signsupp_tx_hash;
    this.supplier_signed_documents = props.supplier_signed_documents;
    this.chairman_signed_at = props.chairman_signed_at;
    this.chairman_account = props.chairman_account;
    this.chairman_signchair_tx_hash = props.chairman_signchair_tx_hash;
    this.total_amount = props.total_amount;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get awaits_supplier(): boolean {
    return this.status === MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN;
  }

  public get awaits_chairman(): boolean {
    return this.status === MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN;
  }

  public get is_accepted(): boolean {
    return this.status === MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP;
  }
}
