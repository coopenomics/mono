import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from './marketplace-return-claim.types';
import type { MarketplaceSupplierClaimProps, MarketplaceSupplierClaimStatus } from './marketplace-supplier-claim.types';

/** Гарантийная претензия поставщику — см. описание статусов в types. */
export class MarketplaceSupplierClaimDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly claim_hash: string;
  public readonly return_claim_id: string;
  public readonly order_id: string;
  public readonly order_hash: string;
  public readonly supplier_account: string;
  public readonly orderer_account: string;
  public readonly delivery_braname: string;
  public readonly actual_quantity: number;
  public readonly amount: string;
  public readonly reason_text: string;
  public readonly inspection_result: string;
  public readonly photos: MarketplaceReturnClaimPhoto[];
  public readonly reclamation: ISignedDocument | null;
  public status: MarketplaceSupplierClaimStatus;
  public readonly issued_at: Date;
  public decided_at: Date | null;
  public readonly issue_tx_hash: string;
  public decide_tx_hash: string | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceSupplierClaimProps) {
    if (!props.id || !props.coopname || !props.claim_hash || !props.supplier_account) {
      throw new Error('MarketplaceSupplierClaimDomainEntity: обязательные поля отсутствуют.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.claim_hash = props.claim_hash;
    this.return_claim_id = props.return_claim_id;
    this.order_id = props.order_id;
    this.order_hash = props.order_hash;
    this.supplier_account = props.supplier_account;
    this.orderer_account = props.orderer_account;
    this.delivery_braname = props.delivery_braname;
    this.actual_quantity = props.actual_quantity;
    this.amount = props.amount;
    this.reason_text = props.reason_text;
    this.inspection_result = props.inspection_result;
    this.photos = props.photos;
    this.reclamation = props.reclamation;
    this.status = props.status;
    this.issued_at = props.issued_at;
    this.decided_at = props.decided_at;
    this.issue_tx_hash = props.issue_tx_hash;
    this.decide_tx_hash = props.decide_tx_hash;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
