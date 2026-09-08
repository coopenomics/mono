import type { MarketplaceSupplierClaimDomainEntity } from '../entities/marketplace-supplier-claim.entity';
import type { MarketplaceSupplierClaimProps, MarketplaceSupplierClaimStatus } from '../entities/marketplace-supplier-claim.types';

export const MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY = Symbol('MARKETPLACE_SUPPLIER_CLAIM_REPOSITORY');

export type MarketplaceSupplierClaimCreateInput = Omit<
  MarketplaceSupplierClaimProps,
  'id' | 'status' | 'decided_at' | 'refuse_reason' | 'auto_admitted' | 'decide_tx_hash' | 'created_at' | 'updated_at'
>;

export interface MarketplaceSupplierClaimDecisionPatch {
  status: MarketplaceSupplierClaimStatus;
  decided_at: Date;
  refuse_reason?: string | null;
  auto_admitted?: boolean;
  decide_tx_hash?: string | null;
}

export interface MarketplaceSupplierClaimDomainRepository {
  /** Идемпотентно по `(coopname, claim_hash)`: повтор события совета не плодит претензий. */
  createIfNotExists(input: MarketplaceSupplierClaimCreateInput): Promise<MarketplaceSupplierClaimDomainEntity>;
  findById(id: string): Promise<MarketplaceSupplierClaimDomainEntity | null>;
  findByClaimHash(coopname: string, claim_hash: string): Promise<MarketplaceSupplierClaimDomainEntity | null>;
  listBySupplier(coopname: string, supplier_account: string): Promise<MarketplaceSupplierClaimDomainEntity[]>;
  listAll(coopname: string, filter?: { supplier_account?: string; statuses?: MarketplaceSupplierClaimStatus[] }): Promise<MarketplaceSupplierClaimDomainEntity[]>;
  /** Претензии без ответа, выставленные раньше `before` — кандидаты на автоприём. */
  listPendingIssuedBefore(coopname: string, before: Date): Promise<MarketplaceSupplierClaimDomainEntity[]>;
  /** CAS-переход из PENDING; `null` — запись уже не в PENDING (повтор события). */
  decide(id: string, patch: MarketplaceSupplierClaimDecisionPatch): Promise<MarketplaceSupplierClaimDomainEntity | null>;
}
