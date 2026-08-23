import { Injectable } from '@nestjs/common';
import { MarketplaceCategoryDomainEntity } from '../../domain/entities/marketplace-category.entity';
import { MarketplaceCategoryEntity } from '../entities/marketplace-category.entity';

@Injectable()
export class MarketplaceCategoryMapper {
  toDomain(row: MarketplaceCategoryEntity): MarketplaceCategoryDomainEntity {
    return new MarketplaceCategoryDomainEntity({
      id: row.id,
      display_name: row.display_name,
      sort_order: row.sort_order,
      mvp_baseline: row.mvp_baseline,
      coopname: row.coopname ?? null,
    });
  }
}
