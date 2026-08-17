import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';
import type {
  MarketplaceConsolidatedRequestCreateInput,
  MarketplaceConsolidatedRequestDomainRepository,
  MarketplaceConsolidatedRequestListFilter,
} from '../../domain/repositories/marketplace-consolidated-request.repository';
import type { MarketplaceConsolidatedRequestStatus } from '../../domain/entities/marketplace-consolidated-request.types';
import { MarketplaceConsolidatedRequestEntity } from '../entities/marketplace-consolidated-request.entity';
import { MarketplaceConsolidatedRequestMapper } from '../mappers/marketplace-consolidated-request.mapper';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

@Injectable()
export class MarketplaceConsolidatedRequestRepositoryAdapter
  implements MarketplaceConsolidatedRequestDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceConsolidatedRequestEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceConsolidatedRequestEntity>,
    private readonly mapper: MarketplaceConsolidatedRequestMapper
  ) {}

  async create(
    input: MarketplaceConsolidatedRequestCreateInput
  ): Promise<MarketplaceConsolidatedRequestDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      offer_id: input.offer_id,
      supplier_account: input.supplier_account,
      total_quantity: input.total_quantity,
      total_amount: input.total_amount,
      status: input.status,
      cycle_started_at: input.cycle_started_at,
      cycle_ended_at: input.cycle_ended_at,
      expires_at: input.expires_at,
      accepted_at: input.status === 'ACCEPTED' ? new Date() : null,
      declined_at: null,
      decline_reason: null,
      triggered_by_supplier_at: input.triggered_by_supplier_at,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceConsolidatedRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findExpiredAwaitingResponse(
    now: Date
  ): Promise<MarketplaceConsolidatedRequestDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('r')
      .where('r.status = :s', { s: 'PENDING_SUPPLIER_ACCEPT' as MarketplaceConsolidatedRequestStatus })
      .andWhere('r.expires_at IS NOT NULL AND r.expires_at < :now', { now })
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async list(
    filter: MarketplaceConsolidatedRequestListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceConsolidatedRequestDomainEntity>> {
    const qb = this.repo.createQueryBuilder('r').where('r.coopname = :coop', { coop: filter.coopname });
    if (filter.offer_id) qb.andWhere('r.offer_id = :off', { off: filter.offer_id });
    if (filter.supplier_account) qb.andWhere('r.supplier_account = :sup', { sup: filter.supplier_account });
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      qb.andWhere('r.status IN (:...statuses)', { statuses });
    }
    qb.orderBy('r.updated_at', pagination.sortOrder ?? 'DESC');
    qb.skip((pagination.page - 1) * pagination.limit).take(pagination.limit);
    const [rows, totalCount] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.mapper.toDomain(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / pagination.limit),
      currentPage: pagination.page,
    };
  }

  async applyStatusTransition(
    id: string,
    newStatus: MarketplaceConsolidatedRequestStatus,
    options: { decline_reason?: string | null } = {}
  ): Promise<MarketplaceConsolidatedRequestDomainEntity> {
    const patch: Partial<MarketplaceConsolidatedRequestEntity> = { status: newStatus };
    if (newStatus === 'ACCEPTED') patch.accepted_at = new Date();
    else if (newStatus === 'DECLINED_BY_SUPPLIER' || newStatus === 'EXPIRED_NO_RESPONSE') {
      patch.declined_at = new Date();
      patch.decline_reason = options.decline_reason ?? null;
    }
    await this.repo.update({ id }, patch as Record<string, unknown>);
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }
}
