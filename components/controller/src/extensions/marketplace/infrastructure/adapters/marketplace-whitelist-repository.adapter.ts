import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MarketplaceWhitelistDomainRepository } from '../../domain/repositories/marketplace-whitelist.repository';
import {
  MarketplaceWhitelistEntryDomainEntity,
  type MarketplaceWhitelistRole,
} from '../../domain/entities/marketplace-whitelist-entry.entity';
import { MarketplaceWhitelistEntity } from '../entities/marketplace-whitelist.entity';
import { MarketplaceWhitelistMapper } from '../mappers/marketplace-whitelist.mapper';

@Injectable()
export class MarketplaceWhitelistRepositoryAdapter implements MarketplaceWhitelistDomainRepository {
  constructor(
    @InjectRepository(MarketplaceWhitelistEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceWhitelistEntity>,
    private readonly mapper: MarketplaceWhitelistMapper
  ) {}

  async list(cooperative_id: string): Promise<MarketplaceWhitelistEntryDomainEntity[]> {
    const rows = await this.repo.find({
      where: { cooperative_id },
      order: { added_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findByMember(
    cooperative_id: string,
    member_account: string
  ): Promise<MarketplaceWhitelistEntryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { cooperative_id, member_account } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async add(
    cooperative_id: string,
    member_account: string,
    role: MarketplaceWhitelistRole,
    added_by: string | null
  ): Promise<MarketplaceWhitelistEntryDomainEntity> {
    const existing = await this.repo.findOne({ where: { cooperative_id, member_account } });
    if (existing) return this.mapper.toDomain(existing);

    const row = this.repo.create({
      cooperative_id,
      member_account,
      role,
      added_by,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async remove(cooperative_id: string, member_account: string): Promise<void> {
    await this.repo.delete({ cooperative_id, member_account });
  }

  async countManual(cooperative_id: string): Promise<number> {
    return this.repo.count({ where: { cooperative_id, role: 'manual' } });
  }
}
