import type { MarketplaceAplReceptionDomainEntity } from '../entities/marketplace-apl-reception.entity';
import type {
  MarketplaceAplReceptionExpeditorData,
  MarketplaceAplReceptionFactQuantityEntry,
  MarketplaceAplReceptionStatus,
  MarketplaceAplReceptionVariant,
} from '../entities/marketplace-apl-reception.types';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

export const MARKETPLACE_APL_RECEPTION_REPOSITORY = Symbol('MARKETPLACE_APL_RECEPTION_REPOSITORY');

export interface MarketplaceAplReceptionCreateInput {
  coopname: string;
  shipment_id: string;
  cycle_id: string;
  braname: string;
  offerer_account: string;
  variant: MarketplaceAplReceptionVariant;
  status: MarketplaceAplReceptionStatus;
  fact_quantity_per_order: MarketplaceAplReceptionFactQuantityEntry[];
  ttn_number: string | null;
  expeditor_data: MarketplaceAplReceptionExpeditorData | null;
  created_by_operator_account: string;
  total_amount: string;
}

export interface MarketplaceAplReceptionUpdateSignaturesInput {
  supplier_signed_at?: Date | null;
  supplier_signsupp_tx_hash?: string | null;
  supplier_signed_documents?: ISignedDocumentDomainInterface[] | null;
  chairman_signed_at?: Date | null;
  chairman_account?: string | null;
  chairman_signchair_tx_hash?: string | null;
  status?: MarketplaceAplReceptionStatus;
}

export interface MarketplaceAplReceptionDomainRepository {
  create(input: MarketplaceAplReceptionCreateInput): Promise<MarketplaceAplReceptionDomainEntity>;

  findById(id: string): Promise<MarketplaceAplReceptionDomainEntity | null>;

  findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceAplReceptionDomainEntity | null>;

  findByTTNNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceAplReceptionDomainEntity | null>;

  listByBraname(
    coopname: string,
    braname: string,
    status?: MarketplaceAplReceptionStatus | MarketplaceAplReceptionStatus[]
  ): Promise<MarketplaceAplReceptionDomainEntity[]>;

  listByOfferer(
    coopname: string,
    offerer_account: string,
    status?: MarketplaceAplReceptionStatus | MarketplaceAplReceptionStatus[]
  ): Promise<MarketplaceAplReceptionDomainEntity[]>;

  applySignatures(
    id: string,
    patch: MarketplaceAplReceptionUpdateSignaturesInput
  ): Promise<MarketplaceAplReceptionDomainEntity>;
}
