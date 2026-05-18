import type { MarketplaceTtnDocumentDomainEntity } from '../entities/marketplace-ttn-document.entity';
import type { MarketplaceShipmentTTNData } from '../entities/marketplace-shipment.types';

export const MARKETPLACE_TTN_DOCUMENT_REPOSITORY = Symbol(
  'MARKETPLACE_TTN_DOCUMENT_REPOSITORY'
);

export interface MarketplaceTtnDocumentCreateInput {
  coopname: string;
  shipment_id: string;
  ttn_number: string;
  registry_id: number;
  document_hash: string;
  content_html: string;
  meta: Record<string, unknown>;
  supplier_account: string;
  accept_braname: string;
  total_amount: string;
  currency: string;
  ttn_data: MarketplaceShipmentTTNData;
}

export interface MarketplaceTtnDocumentDomainRepository {
  create(
    input: MarketplaceTtnDocumentCreateInput
  ): Promise<MarketplaceTtnDocumentDomainEntity>;

  findById(id: string): Promise<MarketplaceTtnDocumentDomainEntity | null>;

  findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null>;

  findByTtnNumber(
    coopname: string,
    ttn_number: string
  ): Promise<MarketplaceTtnDocumentDomainEntity | null>;
}
