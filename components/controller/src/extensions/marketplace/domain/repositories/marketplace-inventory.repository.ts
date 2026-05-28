import type { MarketplaceInventoryDomainEntity } from '../entities/marketplace-inventory.entity';
import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryStatus,
} from '../entities/marketplace-inventory.types';

export const MARKETPLACE_INVENTORY_REPOSITORY = Symbol('MARKETPLACE_INVENTORY_REPOSITORY');

export interface MarketplaceInventoryCreateInput {
  coopname: string;
  barcode_value: string;
  barcode_format: MarketplaceBarcodeFormat;
  order_id: string;
  shipment_id: string;
  braname: string;
  status: MarketplaceInventoryStatus;
  product_name_snapshot: string;
  quantity_per_label: number;
  orderer_account_snapshot: string;
  labeled_at: Date;
  labeled_by_operator_account: string;
  expiry_date?: Date | null;
}

export interface MarketplaceInventoryListFilter {
  coopname: string;
  order_id?: string;
  shipment_id?: string;
  // Массив branames — для ownership-скоупинга оператора по нескольким своим КУ.
  braname?: string | string[];
  status?: MarketplaceInventoryStatus | MarketplaceInventoryStatus[];
}

export interface MarketplaceInventoryDomainRepository {
  create(input: MarketplaceInventoryCreateInput): Promise<MarketplaceInventoryDomainEntity>;

  findById(id: string): Promise<MarketplaceInventoryDomainEntity | null>;

  findByBarcode(
    coopname: string,
    barcode_value: string
  ): Promise<MarketplaceInventoryDomainEntity | null>;

  countByOrder(coopname: string, order_id: string): Promise<number>;

  list(filter: MarketplaceInventoryListFilter): Promise<MarketplaceInventoryDomainEntity[]>;

  applyStatusTransition(
    id: string,
    newStatus: MarketplaceInventoryStatus
  ): Promise<MarketplaceInventoryDomainEntity>;
}
