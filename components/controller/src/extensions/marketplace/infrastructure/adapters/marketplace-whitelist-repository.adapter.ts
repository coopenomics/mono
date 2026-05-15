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

  async list(coopname: string): Promise<MarketplaceWhitelistEntryDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname },
      order: { added_at: 'ASC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findByMember(
    coopname: string,
    member_account: string
  ): Promise<MarketplaceWhitelistEntryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, member_account } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async add(
    coopname: string,
    member_account: string,
    role: MarketplaceWhitelistRole,
    added_by: string | null
  ): Promise<MarketplaceWhitelistEntryDomainEntity> {
    const existing = await this.repo.findOne({ where: { coopname, member_account } });
    if (existing) return this.mapper.toDomain(existing);

    const row = this.repo.create({
      coopname,
      member_account,
      role,
      added_by,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async remove(coopname: string, member_account: string): Promise<void> {
    await this.repo.delete({ coopname, member_account });
  }

  async countManual(coopname: string): Promise<number> {
    return this.repo.count({ where: { coopname, role: 'manual' } });
  }
}
