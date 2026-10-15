import { TableStore, lessThan, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_CONSOLIDATED_REQUEST_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_STORE)
private readonly repo: TableStore<MarketplaceConsolidatedRequestEntity>,
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
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findExpiredAwaitingResponse(
    now: Date
  ): Promise<MarketplaceConsolidatedRequestDomainEntity[]> {
    // Заявки без срока в отбор не попадают: сравнение с пустым значением ложно.
    const rows = await this.repo.find({
      status: 'PENDING_SUPPLIER_ACCEPT' as MarketplaceConsolidatedRequestStatus,
      expires_at: lessThan(now),
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async list(
    filter: MarketplaceConsolidatedRequestListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceConsolidatedRequestDomainEntity>> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.offer_id) where.offer_id = filter.offer_id;
    if (filter.supplier_account) where.supplier_account = filter.supplier_account;
    if (filter.status) where.status = oneOf(Array.isArray(filter.status) ? filter.status : [filter.status]);
    const [rows, totalCount] = await this.repo.findAndCount(where, {
      order: { updated_at: pagination.sortOrder === 'ASC' ? 'ASC' : 'DESC' },
      offset: (pagination.page - 1) * pagination.limit,
      limit: pagination.limit,
    });
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
    const row = await this.repo.findOneOrFail({ id });
    return this.mapper.toDomain(row);
  }
}
