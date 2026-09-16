import type { MarketplaceSupplierClaimDomainEntity } from '../entities/marketplace-supplier-claim.entity';
import type { MarketplaceSupplierClaimProps, MarketplaceSupplierClaimStatus } from '../entities/marketplace-supplier-claim.types';

export const MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY = Symbol('MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY');

export type MarketplaceSupplierClaimCreateInput = Omit<
  MarketplaceSupplierClaimProps,
  'id' | 'status' | 'decided_at' | 'decide_tx_hash' | 'created_at' | 'updated_at'
>;

export interface MarketplaceSupplierClaimAdmitPatch {
  decided_at: Date;
  decide_tx_hash?: string | null;
}

export interface MarketplaceSupplierClaimDomainRepository {
  /** Идемпотентно по `(coopname, claim_hash)`: повтор события совета не плодит претензий. */
  createIfNotExists(input: MarketplaceSupplierClaimCreateInput): Promise<MarketplaceSupplierClaimDomainEntity>;
  findById(id: string): Promise<MarketplaceSupplierClaimDomainEntity | null>;
  findByClaimHash(coopname: string, claim_hash: string): Promise<MarketplaceSupplierClaimDomainEntity | null>;
  listBySupplier(coopname: string, supplier_account: string): Promise<MarketplaceSupplierClaimDomainEntity[]>;
  listAll(coopname: string, filter?: { supplier_account?: string; statuses?: MarketplaceSupplierClaimStatus[] }): Promise<MarketplaceSupplierClaimDomainEntity[]>;
  /** CAS-переход PENDING → ADMITTED; `null` — претензия уже признана (повтор события). */
  admit(id: string, patch: MarketplaceSupplierClaimAdmitPatch): Promise<MarketplaceSupplierClaimDomainEntity | null>;
}
