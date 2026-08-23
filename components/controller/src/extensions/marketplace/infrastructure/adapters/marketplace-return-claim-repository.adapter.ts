import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import {
  MarketplaceReturnClaimStatuses,
  type MarketplaceReturnClaimStatus,
} from '../../domain/entities/marketplace-return-claim.types';
import type {
  MarketplaceReturnClaimApplyDecisionInput,
  MarketplaceReturnClaimCreateInput,
  MarketplaceReturnClaimDomainRepository,
} from '../../domain/repositories/marketplace-return-claim.repository';
import { MarketplaceReturnClaimEntity } from '../entities/marketplace-return-claim.entity';
import { MarketplaceReturnClaimMapper } from '../mappers/marketplace-return-claim.mapper';

const ACTIVE_STATUSES: MarketplaceReturnClaimStatus[] = [
  MarketplaceReturnClaimStatuses.PENDING_CHAIRMAN_REVIEW,
  MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT,
];

@Injectable()
export class MarketplaceReturnClaimRepositoryAdapter
  implements MarketplaceReturnClaimDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceReturnClaimEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceReturnClaimEntity>,
    private readonly mapper: MarketplaceReturnClaimMapper
  ) {}

  async create(
    input: MarketplaceReturnClaimCreateInput
  ): Promise<MarketplaceReturnClaimDomainEntity> {
    const row = this.repo.create({
      id: input.id,
      coopname: input.coopname,
      request_hash: input.request_hash,
      order_id: input.order_id,
      order_hash: input.order_hash,
      orderer_account: input.orderer_account,
      delivery_braname: input.delivery_braname,
      supplier_account: input.supplier_account,
      status: input.status,
      reason_text: input.reason_text,
      defect_category: input.defect_category,
      expected_resolution: input.expected_resolution,
      actual_quantity: input.actual_quantity,
      fact_cost: input.fact_cost,
      fee_refund: input.fee_refund,
      photos: input.photos,
      statement: input.statement,
      submretrn_tx_hash: input.submretrn_tx_hash,
      decision_log: [],
      on_site_inspection: null,
      ledger_snapshot: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceReturnClaimDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByRequestHash(
    coopname: string,
    request_hash: string
  ): Promise<MarketplaceReturnClaimDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, request_hash } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findActiveByOrderId(
    coopname: string,
    order_id: string
  ): Promise<MarketplaceReturnClaimDomainEntity | null> {
    const row = await this.repo.findOne({
      where: { coopname, order_id, status: In(ACTIVE_STATUSES) },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listByOrderer(
    coopname: string,
    orderer_account: string,
    status?: MarketplaceReturnClaimStatus | MarketplaceReturnClaimStatus[]
  ): Promise<MarketplaceReturnClaimDomainEntity[]> {
    const where: Record<string, unknown> = { coopname, orderer_account };
    if (status) where.status = Array.isArray(status) ? In(status) : status;
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listByDeliveryBraname(
    coopname: string,
    delivery_braname: string,
    status?: MarketplaceReturnClaimStatus | MarketplaceReturnClaimStatus[]
  ): Promise<MarketplaceReturnClaimDomainEntity[]> {
    // Если status не передан — возвращаем ВСЕ заявления (включая архив):
    // operator-стол на КУ показывает три секции (pending/approved/archive),
    // и архивная секция требует финальные статусы. Раньше дефолт был
    // ACTIVE_STATUSES — это делало секцию архива всегда пустой.
    const where: Record<string, unknown> = { coopname, delivery_braname };
    if (status !== undefined) {
      where.status = Array.isArray(status) ? In(status) : status;
    }
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applyDecision(
    id: string,
    input: MarketplaceReturnClaimApplyDecisionInput
  ): Promise<MarketplaceReturnClaimDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    const nextLog = [...(row.decision_log ?? []), input.decision_entry];
    const patch: Partial<MarketplaceReturnClaimEntity> = {
      status: input.status,
      decision_log: nextLog,
    };
    if (input.on_site_inspection !== undefined) patch.on_site_inspection = input.on_site_inspection;
    if (input.ledger_snapshot !== undefined) patch.ledger_snapshot = input.ledger_snapshot;
    await this.repo.update({ id }, patch);
    const fresh = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(fresh);
  }
}
