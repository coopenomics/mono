import type { MarketplaceSupplierDomainEntity } from '../entities/marketplace-supplier.entity';
import type {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '../entities/marketplace-supplier.types';

export const MARKETPLACE_SUPPLIER_REPOSITORY = Symbol('MARKETPLACE_SUPPLIER_REPOSITORY');

export interface MarketplaceSupplierCreateInput {
  coopname: string;
  member_account: string;
  model: MarketplaceSupplierModel;
  status: MarketplaceSupplierStatus;
  contract_number: string | null;
  contract_date: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
}

export interface MarketplaceSupplierPatchInput {
  model?: MarketplaceSupplierModel;
  status?: MarketplaceSupplierStatus;
  contract_number?: string | null;
  contract_date?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
}

export interface MarketplaceSupplierDomainRepository {
  list(coopname: string): Promise<MarketplaceSupplierDomainEntity[]>;
  findByMember(
    coopname: string,
    member_account: string
  ): Promise<MarketplaceSupplierDomainEntity | null>;
  create(input: MarketplaceSupplierCreateInput): Promise<MarketplaceSupplierDomainEntity>;
  patch(
    coopname: string,
    member_account: string,
    patch: MarketplaceSupplierPatchInput
  ): Promise<MarketplaceSupplierDomainEntity>;
  remove(coopname: string, member_account: string): Promise<void>;
}
