import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETPLACE_CATEGORY_REPOSITORY,
  type MarketplaceCategoryDomainRepository,
} from '../../domain/repositories/marketplace-category.repository';
import type { MarketplaceCategoryDomainEntity } from '../../domain/entities/marketplace-category.entity';

export const MARKETPLACE_CATEGORY_SERVICE = Symbol('MARKETPLACE_CATEGORY_SERVICE');

/**
 * Story 3.5: чтение 10 baseline-категорий для фильтр-чипов и формы
 * создания Offer'а (Story 3.2).
 */
@Injectable()
export class MarketplaceCategoryService {
  constructor(
    @Inject(MARKETPLACE_CATEGORY_REPOSITORY)
    private readonly repo: MarketplaceCategoryDomainRepository
  ) {}

  async listBaseline(): Promise<MarketplaceCategoryDomainEntity[]> {
    return this.repo.listBaseline();
  }
}
