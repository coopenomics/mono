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

  async findDefault(coopname: string): Promise<MarketplaceVitrineDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, is_default: true } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(coopname: string): Promise<MarketplaceVitrineDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname },
      order: { created_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async ensureDefault(
    coopname: string,
    display_name: string
  ): Promise<MarketplaceVitrineDomainEntity> {
    const existing = await this.repo.findOne({ where: { coopname, is_default: true } });
    if (existing) return this.mapper.toDomain(existing);

    const row = this.repo.create({
      id: 'default',
      coopname,
      display_name,
      is_default: true,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }
}
