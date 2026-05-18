import type { MarketplaceShipmentDomainEntity } from '../entities/marketplace-shipment.entity';
import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from '../entities/marketplace-shipment.types';

export const MARKETPLACE_SHIPMENT_REPOSITORY = Symbol('MARKETPLACE_SHIPMENT_REPOSITORY');

export interface MarketplaceShipmentCreateInput {
  coopname: string;
  cycle_id: string;
  offerer_account: string;
  braname: string;
  delivery_variant: MarketplaceShipmentDeliveryVariant;
  total_amount: string;
  ttn_number: string | null;
  ttn_data: MarketplaceShipmentTTNData | null;
  ttn_document_id: string | null;
  status: MarketplaceShipmentStatus;
}

export interface MarketplaceShipmentListFilter {
  coopname: string;
  cycle_id?: string;
  offerer_account?: string;
  braname?: string;
  status?: MarketplaceShipmentStatus | MarketplaceShipmentStatus[];
}

/**
 * Story 5.1: репозиторий Shipment'а. Backend-only (нет integration
 * с IBlockchainSyncRepository).
 */
export interface MarketplaceShipmentDomainRepository {
  create(input: MarketplaceShipmentCreateInput): Promise<MarketplaceShipmentDomainEntity>;

  findById(id: string): Promise<MarketplaceShipmentDomainEntity | null>;

  findByCycleAndKU(
    coopname: string,
    cycle_id: string,
    braname: string
  ): Promise<MarketplaceShipmentDomainEntity | null>;

  findByCycleId(coopname: string, cycle_id: string): Promise<MarketplaceShipmentDomainEntity[]>;

  findByTTNNumber(coopname: string, ttn_number: string): Promise<MarketplaceShipmentDomainEntity | null>;

  list(filter: MarketplaceShipmentListFilter): Promise<MarketplaceShipmentDomainEntity[]>;

  applyStatusTransition(
    id: string,
    newStatus: MarketplaceShipmentStatus
  ): Promise<MarketplaceShipmentDomainEntity>;

  /** Story 5.4: проставить ссылку на запись локального ТТН-документа после его генерации. */
  applyTtnDocumentId(
    shipment_id: string,
    ttn_document_id: string
  ): Promise<MarketplaceShipmentDomainEntity>;
}
