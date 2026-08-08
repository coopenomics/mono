import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';
import {
  MarketplaceStockProposalStatuses,
  type MarketplaceStockProposalStatus,
} from '../../domain/entities/marketplace-stock-proposal.types';
import type {
  MarketplaceStockProposalCreateInput,
  MarketplaceStockProposalDomainRepository,
  MarketplaceStockProposalListFilter,
} from '../../domain/repositories/marketplace-stock-proposal.repository';
import { MarketplaceStockProposalEntity } from '../entities/marketplace-stock-proposal.entity';
import { MarketplaceStockProposalMapper } from '../mappers/marketplace-stock-proposal.mapper';

@Injectable()
export class MarketplaceStockProposalRepositoryAdapter
  implements MarketplaceStockProposalDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceStockProposalEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceStockProposalEntity>,
    private readonly mapper: MarketplaceStockProposalMapper
  ) {}

  async create(
    input: MarketplaceStockProposalCreateInput
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      braname: input.braname,
      member_account: input.member_account,
      operator_account: input.operator_account,
      items: input.items,
      status: MarketplaceStockProposalStatuses.PROPOSED,
      created_order_ids: [],
      resolved_at: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceStockProposalDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(
    filter: MarketplaceStockProposalListFilter
  ): Promise<MarketplaceStockProposalDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.member_account) where.member_account = filter.member_account;
    if (filter.braname) {
      where.braname = Array.isArray(filter.braname) ? In(filter.braname) : filter.braname;
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? In(filter.status) : filter.status;
    }
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applyResolution(
    id: string,
    from_status: MarketplaceStockProposalStatus,
    to_status: MarketplaceStockProposalStatus,
    created_order_ids?: string[]
  ): Promise<MarketplaceStockProposalDomainEntity | null> {
    const res = await this.repo.update(
      { id, status: from_status },
      {
        status: to_status,
        resolved_at: new Date(),
        ...(created_order_ids ? { created_order_ids } : {}),
      }
    );
    if (!res.affected) return null;
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }
}
