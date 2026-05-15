import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceVitrineDomainRepository } from '../../domain/repositories/marketplace-vitrine.repository';
import { MarketplaceVitrineDomainEntity } from '../../domain/entities/marketplace-vitrine.entity';
import { MarketplaceVitrineEntity } from '../entities/marketplace-vitrine.entity';
import { MarketplaceVitrineMapper } from '../mappers/marketplace-vitrine.mapper';

@Injectable()
export class MarketplaceVitrineRepositoryAdapter implements MarketplaceVitrineDomainRepository {
  constructor(
    @InjectRepository(MarketplaceVitrineEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceVitrineEntity>,
    private readonly mapper: MarketplaceVitrineMapper
  ) {}

  async findDefault(cooperative_id: string): Promise<MarketplaceVitrineDomainEntity | null> {
    const row = await this.repo.findOne({ where: { cooperative_id, is_default: true } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(cooperative_id: string): Promise<MarketplaceVitrineDomainEntity[]> {
    const rows = await this.repo.find({
      where: { cooperative_id },
      order: { created_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async ensureDefault(
    cooperative_id: string,
    display_name: string
  ): Promise<MarketplaceVitrineDomainEntity> {
    const existing = await this.repo.findOne({ where: { cooperative_id, is_default: true } });
    if (existing) return this.mapper.toDomain(existing);

    const row = this.repo.create({
      id: 'default',
      cooperative_id,
      display_name,
      is_default: true,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }
}
