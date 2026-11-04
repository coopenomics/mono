import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { affectedCount } from '@coopenomics/extension-kit';
import {
  PayoutRequestStatusEnum,
  type PayoutRequestCreate,
  type PayoutRequestDomainInterface,
  type PayoutRequestRepository,
} from '~/domain/gateway/repositories/payout-request.repository';
import type { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { PayoutRequests } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

type Row = Selectable<PayoutRequests>;

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));

function toDomain(row: Row): PayoutRequestDomainInterface {
  return {
    id: row.id,
    hash: row.hash,
    coopname: row.coopname,
    username: row.username,
    // numeric приходит из базы строкой.
    quantity: Number(row.quantity),
    symbol: row.symbol,
    type: row.type as PaymentTypeEnum,
    provider: row.provider,
    payment_method_id: row.payment_method_id,
    memo: row.memo,
    expired_at: row.expired_at,
    payment_details: row.payment_details as PayoutRequestDomainInterface['payment_details'],
    blockchain_data: row.blockchain_data as PayoutRequestDomainInterface['blockchain_data'],
    statement: row.statement as PayoutRequestDomainInterface['statement'],
    related_extension: row.related_extension,
    related_entity_id: row.related_entity_id,
    status: row.status as PayoutRequestStatusEnum,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Заявки на выплату до решения совета (таблица `payout_requests`). */
@Injectable()
export class PayoutRequestKyselyRepository implements PayoutRequestRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(data: PayoutRequestCreate): Promise<PayoutRequestDomainInterface> {
    const row = await this.db
      .insertInto('payout_requests')
      .values({
        hash: data.hash.toLowerCase(),
        coopname: data.coopname,
        username: data.username,
        quantity: data.quantity,
        symbol: data.symbol,
        type: data.type as Row['type'],
        provider: data.provider ?? null,
        payment_method_id: data.payment_method_id ?? null,
        memo: data.memo ?? null,
        expired_at: data.expired_at ?? null,
        payment_details: json(data.payment_details),
        blockchain_data: json(data.blockchain_data),
        statement: json(data.statement),
        related_extension: data.related_extension ?? null,
        related_entity_id: data.related_entity_id ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findByHash(hash: string): Promise<PayoutRequestDomainInterface | null> {
    const row = await this.db
      .selectFrom('payout_requests')
      .selectAll()
      .where('hash', '=', hash.toLowerCase())
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async markDecided(
    hash: string,
    status: PayoutRequestStatusEnum.RELEASED | PayoutRequestStatusEnum.DECLINED
  ): Promise<boolean> {
    const now = new Date();
    const result = await this.db
      .updateTable('payout_requests')
      .set({ status, decided_at: now, updated_at: now })
      .where('hash', '=', hash.toLowerCase())
      .where('status', '=', PayoutRequestStatusEnum.AWAITING)
      .execute();
    return affectedCount(result) > 0;
  }

  async reopen(hash: string): Promise<void> {
    await this.db
      .updateTable('payout_requests')
      .set({ status: PayoutRequestStatusEnum.AWAITING, decided_at: null, updated_at: new Date() })
      .where('hash', '=', hash.toLowerCase())
      .where('status', '=', PayoutRequestStatusEnum.RELEASED)
      .execute();
  }

  async listAwaitingByMember(coopname: string, username: string): Promise<PayoutRequestDomainInterface[]> {
    const rows = await this.db
      .selectFrom('payout_requests')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('username', '=', username)
      .where('status', '=', PayoutRequestStatusEnum.AWAITING)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toDomain);
  }

  async deleteAwaiting(hash: string): Promise<void> {
    await this.db
      .deleteFrom('payout_requests')
      .where('hash', '=', hash.toLowerCase())
      .where('status', '=', PayoutRequestStatusEnum.AWAITING)
      .execute();
  }
}
