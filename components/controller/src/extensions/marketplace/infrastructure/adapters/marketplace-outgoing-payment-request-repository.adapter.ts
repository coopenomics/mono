import { TableStore, isNull, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_OUTGOING_PAYMENT_REQUEST_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestStatuses } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type {
  MarketplaceOutgoingPaymentLine,
  MarketplaceOutgoingPaymentRequestStatus,
} from '../../domain/entities/marketplace-outgoing-payment-request.types';
import type {
  MarketplaceOutgoingPaymentChainState,
  MarketplaceOutgoingPaymentRequestCreateInput,
  MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import { MarketplaceOutgoingPaymentRequestEntity } from '../entities/marketplace-outgoing-payment-request.entity';
import { MarketplaceOutgoingPaymentRequestMapper } from '../mappers/marketplace-outgoing-payment-request.mapper';

/** Конечные состояния пакета: дельта цепи их не откатывает. */
const FINAL_STATUSES: MarketplaceOutgoingPaymentRequestStatus[] = [
  MarketplaceOutgoingPaymentRequestStatuses.COMPLETED,
  MarketplaceOutgoingPaymentRequestStatuses.DECLINED,
];

@Injectable()
export class MarketplaceOutgoingPaymentRequestRepositoryAdapter
  implements MarketplaceOutgoingPaymentRequestDomainRepository
{
  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_STORE)
    private readonly repo: TableStore<MarketplaceOutgoingPaymentRequestEntity>,
    private readonly mapper: MarketplaceOutgoingPaymentRequestMapper
  ) {}

  async create(
    input: MarketplaceOutgoingPaymentRequestCreateInput
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      payment_hash: input.payment_hash,
      lines: input.lines,
      payee_account: input.payee_account,
      amount: '0',
      symbol: input.symbol,
      purpose: input.purpose,
      payout_destination: input.payout_destination ?? null,
      withheld_amount: '0',
      status: MarketplaceOutgoingPaymentRequestStatuses.OPEN,
      completed_at: null,
      decline_reason: null,
      payout_tx_hash: null,
      core_payment_id: null,
      settled_at: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByPaymentHash(
    coopname: string,
    payment_hash: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, payment_hash });
    return row ? this.mapper.toDomain(row) : null;
  }

  async listByPayee(
    coopname: string,
    payee_account: string,
    statuses?: MarketplaceOutgoingPaymentRequestStatus[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const where: Record<string, unknown> = { coopname, payee_account };
    if (statuses && statuses.length > 0) where.status = oneOf(statuses);
    const rows = await this.repo.find(where, { order: { created_at: 'DESC' } });
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
    if (filter?.statuses && filter.statuses.length > 0) where.status = oneOf(filter.statuses);
    const rows = await this.repo.find(where, { order: { created_at: 'DESC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async applyLines(
    coopname: string,
    payment_hash: string,
    lines: MarketplaceOutgoingPaymentLine[]
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    return this.patch(coopname, payment_hash, () => ({ lines }));
  }

  async applyChainState(
    coopname: string,
    payment_hash: string,
    state: MarketplaceOutgoingPaymentChainState
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    return this.patch(coopname, payment_hash, (row) => ({
      amount: state.amount,
      withheld_amount: state.withheld_amount,
      // Конечное состояние ставят подтверждение и отказ кассира — дельта
      // того же блока его не откатывает.
      status: FINAL_STATUSES.includes(row.status) ? row.status : state.status,
    }));
  }

  async applyCompletion(
    coopname: string,
    payment_hash: string,
    patch: { completed_at: Date; payout_tx_hash?: string | null }
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    return this.patch(coopname, payment_hash, (row) =>
      row.status === MarketplaceOutgoingPaymentRequestStatuses.COMPLETED
        ? null
        : {
            status: MarketplaceOutgoingPaymentRequestStatuses.COMPLETED,
            completed_at: patch.completed_at,
            payout_tx_hash: patch.payout_tx_hash ?? row.payout_tx_hash,
          }
    );
  }

  async applyDecline(
    coopname: string,
    payment_hash: string,
    reason: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    return this.patch(coopname, payment_hash, (row) =>
      row.status === MarketplaceOutgoingPaymentRequestStatuses.DECLINED
        ? null
        : { status: MarketplaceOutgoingPaymentRequestStatuses.DECLINED, decline_reason: reason }
    );
  }

  async applyCorePaymentId(
    coopname: string,
    payment_hash: string,
    core_payment_id: string
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    return this.patch(coopname, payment_hash, () => ({ core_payment_id }));
  }

  async listUnsettled(coopname: string): Promise<MarketplaceOutgoingPaymentRequestDomainEntity[]> {
    const rows = await this.repo.find({ coopname, settled_at: isNull() }, { order: { created_at: 'ASC' } });
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async markSettled(coopname: string, payment_hash: string, at: Date): Promise<void> {
    await this.patch(coopname, payment_hash, (row) => (row.settled_at ? null : { settled_at: at }));
  }

  async deleteByPaymentHash(coopname: string, payment_hash: string): Promise<void> {
    await this.repo.delete({ coopname, payment_hash });
  }

  /** Правка пакета по хэшу; `null` из правила — запись не меняется. */
  private async patch(
    coopname: string,
    payment_hash: string,
    build: (row: MarketplaceOutgoingPaymentRequestEntity) => Partial<MarketplaceOutgoingPaymentRequestEntity> | null
  ): Promise<MarketplaceOutgoingPaymentRequestDomainEntity | null> {
    const row = await this.repo.findOne({ coopname, payment_hash });
    if (!row) return null;
    const changes = build(row);
    if (!changes) return this.mapper.toDomain(row);
    await this.repo.update({ id: row.id }, changes);
    return this.mapper.toDomain(await this.repo.findOneOrFail({ id: row.id }));
  }
}
