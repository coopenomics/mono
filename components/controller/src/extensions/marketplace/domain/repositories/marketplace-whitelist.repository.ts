import type {
  MarketplaceWhitelistEntryDomainEntity,
  MarketplaceWhitelistRole,
} from '../entities/marketplace-whitelist-entry.entity';

export const MARKETPLACE_WHITELIST_REPOSITORY = Symbol('MARKETPLACE_WHITELIST_REPOSITORY');

export interface MarketplaceWhitelistDomainRepository {
  list(coopname: string): Promise<MarketplaceWhitelistEntryDomainEntity[]>;
  findByMember(
    coopname: string,
    member_account: string
  ): Promise<MarketplaceWhitelistEntryDomainEntity | null>;
  add(
    coopname: string,
    member_account: string,
    role: MarketplaceWhitelistRole,
    added_by: string | null
  ): Promise<MarketplaceWhitelistEntryDomainEntity>;
  remove(coopname: string, member_account: string): Promise<void>;
  countManual(coopname: string): Promise<number>;
}
