import type {
  MarketplaceWhitelistEntryDomainEntity,
  MarketplaceWhitelistRole,
} from '../entities/marketplace-whitelist-entry.entity';

export const MARKETPLACE_WHITELIST_REPOSITORY = Symbol('MARKETPLACE_WHITELIST_REPOSITORY');

export interface MarketplaceWhitelistDomainRepository {
  list(cooperative_id: string): Promise<MarketplaceWhitelistEntryDomainEntity[]>;
  findByMember(
    cooperative_id: string,
    member_account: string
  ): Promise<MarketplaceWhitelistEntryDomainEntity | null>;
  add(
    cooperative_id: string,
    member_account: string,
    role: MarketplaceWhitelistRole,
    added_by: string | null
  ): Promise<MarketplaceWhitelistEntryDomainEntity>;
  remove(cooperative_id: string, member_account: string): Promise<void>;
  countManual(cooperative_id: string): Promise<number>;
}
