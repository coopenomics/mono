import type { MarketplaceVitrineDomainEntity } from '../entities/marketplace-vitrine.entity';

export const MARKETPLACE_VITRINE_REPOSITORY = Symbol('MARKETPLACE_VITRINE_REPOSITORY');

export interface MarketplaceVitrineDomainRepository {
  findDefault(coopname: string): Promise<MarketplaceVitrineDomainEntity | null>;
  list(coopname: string): Promise<MarketplaceVitrineDomainEntity[]>;
  ensureDefault(
    coopname: string,
    display_name: string
  ): Promise<MarketplaceVitrineDomainEntity>;
}
