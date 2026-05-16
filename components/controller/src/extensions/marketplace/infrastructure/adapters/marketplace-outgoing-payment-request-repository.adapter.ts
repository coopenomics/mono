import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestStatuses } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type {
  MarketplaceOutgoingPaymentRequestConfirmInput,
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

  async create(
    input: MarketplaceOutgoingPaymentRequestCreateInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      apl_reception_id: input.apl_reception_id,
      payee_account: input.payee_account,
      related_order_ids: input.related_order_ids,
      amount: input.amount,
      symbol: input.symbol,
      purpose: input.purpose,
      status: input.status,
      confirmed_at: null,
      payment_reference: null,
      bank_statement_ref: null,
      blocked_reason: null,
      payout_tx_hash: null,
      core_payment_id: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async applyCorePaymentId(
    id: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    await this.repo.update({ id }, { core_payment_id });
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByAplReceptionId(
    coopname: string,
    apl_reception_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ where: { coopname, apl_reception_id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listByStatus(
    coopname: string,
    status: MarketplaceOutgoingPaymentRequestStatus | MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const where: Record<string, unknown> = { coopname };
    where.status = Array.isArray(status) ? In(status) : status;
    const rows = await this.repo.find({ where, order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listByPayee(
    coopname: string,
    payee_account: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const rows = await this.repo.find({
      where: { coopname, payee_account },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async confirmByCashier(
    id: string,
    patch: MarketplaceOutgoingPaymentRequestConfirmInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    await this.repo.update(
      { id },
      {
        confirmed_at: patch.confirmed_at,
        payment_reference: patch.payment_reference,
        bank_statement_ref: patch.bank_statement_ref ?? null,
        payout_tx_hash: patch.payout_tx_hash ?? null,
        status: patch.status,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async markBlocked(
    id: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    await this.repo.update(
      { id },
      {
        blocked_reason: reason,
        status: MarketplaceOutgoingPaymentRequestStatuses.BLOCKED,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }
}
