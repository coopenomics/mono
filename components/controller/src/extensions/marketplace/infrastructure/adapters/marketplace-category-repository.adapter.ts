import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceCategoryDomainRepository } from '../../domain/repositories/marketplace-category.repository';
import {
  MARKETPLACE_BASELINE_CATEGORIES,
  MarketplaceCategoryDomainEntity,
} from '../../domain/entities/marketplace-category.entity';
import { MarketplaceCategoryEntity } from '../entities/marketplace-category.entity';
import { MarketplaceCategoryMapper } from '../mappers/marketplace-category.mapper';

@Injectable()
export class MarketplaceCategoryRepositoryAdapter
  implements MarketplaceCategoryDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceCategoryEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceCategoryEntity>,
    private readonly mapper: MarketplaceCategoryMapper
  ) {}

  async listBaseline(): Promise<MarketplaceCategoryDomainEntity[]> {
    const rows = await this.repo.find({
      where: { mvp_baseline: true },
      order: { sort_order: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findById(id: number): Promise<MarketplaceCategoryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async upsertBaseline(): Promise<void> {
    for (const c of MARKETPLACE_BASELINE_CATEGORIES) {
      await this.repo.upsert(
        { id: c.id, display_name: c.display_name, sort_order: c.sort_order, mvp_baseline: true },
        ['id']
      );
    }
  }
}
