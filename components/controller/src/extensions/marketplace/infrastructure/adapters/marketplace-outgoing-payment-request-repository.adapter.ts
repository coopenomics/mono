import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestStatuses } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type {
  MarketplaceOutgoingPaymentRequestCreateInput,
  MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import { MarketplaceOutgoingPaymentRequestEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestMapper } from '../mappers/marketplace-outgoing-payment-request.mapper';

@Injectable()
export class MarketplaceOutgoingPaymentRequestRepositoryAdapter
  implements MarketplaceOutgoingPaymentRequestDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceOutgoingPaymentRequestEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceOutgoingPaymentRequestEntity>,
    private readonly mapper: MarketplaceOutgoingPaymentRequestMapper
  ) {}

  async createIfNotExists(
    input: MarketplaceOutgoingPaymentRequestCreateInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    const existing = await this.repo.findOne({
      where: { coopname: input.coopname, order_hash: input.order_hash },
    });
    if (existing) return this.mapper.toDomain(existing);
    const row = this.repo.create({
      coopname: input.coopname,
      order_hash: input.order_hash,
      order_id: input.order_id,
      apl_reception_id: input.apl_reception_id,
      payee_account: input.payee_account,
      amount: input.amount,
      symbol: input.symbol,
      purpose: input.purpose,
      payout_destination: input.payout_destination ?? null,
      status: MarketplaceOutgoingPaymentRequestStatuses.PENDING,
      completed_at: null,
      decline_reason: null,
      payout_tx_hash: input.payout_tx_hash ?? null,
      core_payment_id: input.core_payment_id ?? null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByOrderHash(
    coopname: string,
    order_hash: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, order_hash } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByAplReceptionId(
    coopname: string,
    apl_reception_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname, apl_reception_id },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listByPayee(
    coopname: string,
    payee_account: string,
    statuses?: MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const where: Record<string, unknown> = { coopname, payee_account };
    if (statuses && statuses.length > 0) where.status = In(statuses);
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listAll(
    coopname: string,
    filter?: {
      payee_account?: string;
      statuses?: MarketplaceOutgoingPaymentRequestStatus[];
    }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const where: Record<string, unknown> = { coopname };
    if (filter?.payee_account) where.payee_account = filter.payee_account;
    if (filter?.statuses && filter.statuses.length > 0) where.status = In(filter.statuses);
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applyCompletion(
    coopname: string,
    order_hash: string,
    patch: {
      completed_at: Date;
      core_payment_id?: string | null;
      payout_tx_hash?: string | null;
    }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, order_hash } });
    if (!row) return null;
    if (row.status === MarketplaceOutgoingPaymentRequestStatuses.COMPLETED) {
      return this.mapper.toDomain(row);
    }
    await this.repo.update(
      { id: row.id },
      {
        status: MarketplaceOutgoingPaymentRequestStatuses.COMPLETED,
        completed_at: patch.completed_at,
        core_payment_id: patch.core_payment_id ?? row.core_payment_id,
        payout_tx_hash: patch.payout_tx_hash ?? row.payout_tx_hash,
      }
    );
    const updated = await this.repo.findOneOrFail({ where: { id: row.id } });
    return this.mapper.toDomain(updated);
  }

  async applyDecline(
    coopname: string,
    order_hash: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, order_hash } });
    if (!row) return null;
    if (row.status === MarketplaceOutgoingPaymentRequestStatuses.DECLINED) {
      return this.mapper.toDomain(row);
    }
    await this.repo.update(
      { id: row.id },
      {
        status: MarketplaceOutgoingPaymentRequestStatuses.DECLINED,
        decline_reason: reason,
      }
    );
    const updated = await this.repo.findOneOrFail({ where: { id: row.id } });
    return this.mapper.toDomain(updated);
  }

  async applyCorePaymentId(
    coopname: string,
    order_hash: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, order_hash } });
    if (!row) return null;
    await this.repo.update({ id: row.id }, { core_payment_id });
    const updated = await this.repo.findOneOrFail({ where: { id: row.id } });
    return this.mapper.toDomain(updated);
  }
}
