import type { MarketplaceCategoryDomainEntity } from '../entities/marketplace-category.entity';

export const MARKETPLACE_CATEGORY_REPOSITORY = Symbol('MARKETPLACE_CATEGORY_REPOSITORY');

export interface MarketplaceCategoryDomainRepository {
  listBaseline(): Promise<MarketplaceCategoryDomainEntity[]>;
  findById(id: number): Promise<MarketplaceCategoryDomainEntity | null>;
  upsertBaseline(): Promise<void>;
}
