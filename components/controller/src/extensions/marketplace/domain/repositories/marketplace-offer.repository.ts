import type {
  MarketplaceOfferDomainEntity,
} from '../entities/marketplace-offer.entity';
import type { MarketplaceOfferStatus } from '../entities/marketplace-offer.types';

export const MARKETPLACE_OFFER_REPOSITORY = Symbol('MARKETPLACE_OFFER_REPOSITORY');

export interface OfferListFilter {
  cooperative_id: string;
  supplier_account?: string;
  status?: MarketplaceOfferStatus | MarketplaceOfferStatus[];
  category_id?: number;
  available_only?: boolean;
}

export interface OfferListPage {
  total: number;
  items: MarketplaceOfferDomainEntity[];
}

export interface OfferCreateInput {
  cooperative_id: string;
  supplier_account: string;
  vitrine_id: string;
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: 'piece' | 'kg' | 'liter' | 'pack';
  quantity_available: number;
  unlimited_flag: boolean;
  cycle_type: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
}

export interface OfferUpdateInput {
  product_name?: string;
  description?: string | null;
  category_id?: number;
  price_per_unit?: string;
  unit_of_measure?: 'piece' | 'kg' | 'liter' | 'pack';
  quantity_available?: number;
  unlimited_flag?: boolean;
  cycle_type?: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';
  cycle_days?: number | null;
  target_volume?: number | null;
  max_wait_days?: number | null;
  min_threshold?: number | null;
  warranty_days?: number;
}

export interface MarketplaceOfferDomainRepository {
  findById(id: string): Promise<MarketplaceOfferDomainEntity | null>;
  list(
    filter: OfferListFilter,
    paging: { limit: number; offset: number; sort?: 'created_at_desc' | 'price_asc' | 'price_desc' }
  ): Promise<OfferListPage>;
  countByCategory(cooperative_id: string): Promise<Map<number, number>>;
  countRecentCreatedBy(supplier_account: string, sinceMs: number): Promise<number>;
  create(input: OfferCreateInput): Promise<MarketplaceOfferDomainEntity>;
  applyUpdate(
    id: string,
    patch: OfferUpdateInput & {
      status?: MarketplaceOfferStatus;
      approved_by?: string | null;
      approved_at?: Date | null;
      rejected_by?: string | null;
      rejected_at?: Date | null;
      reject_reason?: string | null;
    }
  ): Promise<MarketplaceOfferDomainEntity>;
}
