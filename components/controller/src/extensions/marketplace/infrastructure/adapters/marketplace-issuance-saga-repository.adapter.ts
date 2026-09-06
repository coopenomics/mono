import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import {
  MARKETPLACE_ISSUANCE_SAGA_ACTIVE_STAGES,
  MarketplaceIssuanceSagaStages,
  type MarketplaceIssuanceSagaStage,
} from '../../domain/entities/marketplace-issuance-saga.types';
import type {
  MarketplaceIssuanceSagaCreateInput,
  MarketplaceIssuanceSagaDomainRepository,
  MarketplaceIssuanceSagaListFilter,
  MarketplaceIssuanceSagaPatch,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import { MarketplaceIssuanceSagaEntity } from '../entities/marketplace-issuance-saga.entity';
import { MarketplaceIssuanceSagaMapper } from '../mappers/marketplace-issuance-saga.mapper';

const ACTIVE_STAGES = [...MARKETPLACE_ISSUANCE_SAGA_ACTIVE_STAGES];

@Injectable()
export class MarketplaceIssuanceSagaRepositoryAdapter implements MarketplaceIssuanceSagaDomainRepository {
  constructor(
    @InjectRepository(MarketplaceIssuanceSagaEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceIssuanceSagaEntity>,
    private readonly mapper: MarketplaceIssuanceSagaMapper
  ) {}

  async createOrReuse(input: MarketplaceIssuanceSagaCreateInput): Promise<MarketplaceIssuanceSagaDomainEntity> {
    const existing = await this.repo.findOne({
      where: { coopname: input.coopname, order_hash: input.order_hash.toLowerCase(), stage: In(ACTIVE_STAGES) },
    });
    if (existing) {
      // Повтор у стойки: факт мог измениться до подписи заявления.
      if (existing.stage === MarketplaceIssuanceSagaStages.FACT_FIXED) {
        await this.repo.update({ id: existing.id }, { fact: input.fact, operator_account: input.operator_account, proposal_id: input.proposal_id });
        return this.mapper.toDomain(await this.repo.findOneOrFail({ where: { id: existing.id } }));
      }
      return this.mapper.toDomain(existing);
    }
    const row = this.repo.create({
      coopname: input.coopname,
      order_id: input.order_id,
      order_hash: input.order_hash.toLowerCase(),
      proposal_id: input.proposal_id,
      member_account: input.member_account,
      operator_account: input.operator_account,
      braname: input.braname,
      stage: MarketplaceIssuanceSagaStages.FACT_FIXED,
      decision_mode: 'UNKNOWN',
      fact: input.fact,
      statement_document: null,
      protocol_document: null,
      act1_document: null,
      act2_document: null,
      act_document_hash: null,
      decision_id: null,
      tx_hashes: {},
      last_error: null,
      attempts: 0,
      decided_at: null,
      closed_at: null,
    });
    return this.mapper.toDomain(await this.repo.save(row));
  }

  async findById(id: string): Promise<MarketplaceIssuanceSagaDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByOrderHash(coopname: string, order_hash: string): Promise<MarketplaceIssuanceSagaDomainEntity | null> {
    const row = await this.repo.findOne({
      where: { coopname, order_hash: order_hash.toLowerCase() },
      order: { created_at: 'DESC' },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findActiveByOrderId(coopname: string, order_id: string): Promise<MarketplaceIssuanceSagaDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, order_id, stage: In(ACTIVE_STAGES) } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(filter: MarketplaceIssuanceSagaListFilter): Promise<MarketplaceIssuanceSagaDomainEntity[]> {
    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.member_account) where.member_account = filter.member_account;
    if (filter.proposal_id) where.proposal_id = filter.proposal_id;
    if (filter.braname) where.braname = Array.isArray(filter.braname) ? In(filter.braname) : filter.braname;
    if (filter.stage) where.stage = Array.isArray(filter.stage) ? In(filter.stage) : filter.stage;
    else if (filter.active_only) where.stage = In(ACTIVE_STAGES);
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async transition(
    id: string,
    from: MarketplaceIssuanceSagaStage | MarketplaceIssuanceSagaStage[],
    patch: MarketplaceIssuanceSagaPatch
  ): Promise<MarketplaceIssuanceSagaDomainEntity | null> {
    const fromStages = Array.isArray(from) ? from : [from];
    const res = await this.repo.update({ id, stage: In(fromStages) }, patch as Record<string, unknown>);
    if (!res.affected) return null;
    return this.mapper.toDomain(await this.repo.findOneOrFail({ where: { id } }));
  }

  async update(id: string, patch: MarketplaceIssuanceSagaPatch): Promise<MarketplaceIssuanceSagaDomainEntity> {
    await this.repo.update({ id }, patch as Record<string, unknown>);
    return this.mapper.toDomain(await this.repo.findOneOrFail({ where: { id } }));
  }

  async findStale(
    coopname: string,
    stages: MarketplaceIssuanceSagaStage[],
    olderThan: Date,
    limit: number
  ): Promise<MarketplaceIssuanceSagaDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname, stage: In(stages), updated_at: LessThan(olderThan) },
      order: { updated_at: 'ASC' },
      take: limit,
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }
}
