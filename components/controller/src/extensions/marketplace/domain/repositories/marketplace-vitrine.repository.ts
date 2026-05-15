import type { MarketplaceVitrineDomainEntity } from '../entities/marketplace-vitrine.entity';

export const MARKETPLACE_VITRINE_REPOSITORY = Symbol('MARKETPLACE_VITRINE_REPOSITORY');

export interface MarketplaceVitrineDomainRepository {
  findDefault(cooperative_id: string): Promise<MarketplaceVitrineDomainEntity | null>;
  list(cooperative_id: string): Promise<MarketplaceVitrineDomainEntity[]>;
  ensureDefault(
    cooperative_id: string,
    display_name: string
  ): Promise<MarketplaceVitrineDomainEntity>;
}
