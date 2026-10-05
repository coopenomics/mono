import { Inject, Injectable } from '@nestjs/common';
import { sql, type Expression, type ExpressionBuilder, type Selectable, type SqlBool } from 'kysely';
import type { PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import type { InternalPaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { getPaymentDirection, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { DB, Payments } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

type PaymentExpression = ExpressionBuilder<DB, 'payments'>;
type Condition = Expression<SqlBool>;
type Row = Selectable<Payments>;

const SUCCEEDED: PaymentStatusEnum[] = [PaymentStatusEnum.COMPLETED, PaymentStatusEnum.PAID];
const FAILED: PaymentStatusEnum[] = [
  PaymentStatusEnum.FAILED,
  PaymentStatusEnum.CANCELLED,
  PaymentStatusEnum.REFUNDED,
  PaymentStatusEnum.EXPIRED,
];

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));
const orNull = <T>(value: T | undefined | null): T | null => value ?? null;
const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

/** Даты исхода платежа по новому статусу: успех снимает дату отказа, отказ — дату успеха. */
function outcomeDates(status: PaymentStatusEnum | undefined, now: Date): Partial<PaymentDomainInterface> {
  if (status && SUCCEEDED.includes(status)) return { completed_at: now, failed_at: undefined };
  if (status && FAILED.includes(status)) return { failed_at: now, completed_at: undefined };
  return {};
}

const EXACT = ['username', 'status', 'coopname', 'provider', 'secret', 'hash'] as const;

/** Условия отбора реестра платежей. */
function conditions(eb: PaymentExpression, filters: InternalPaymentFiltersDomainInterface): Condition[] {
  // Имя пайщика сверяется точно: отбор по нему — это выдача «платежей пайщика»,
  // подстрока отдавала вместе с ними чужие (ant → giant, antonov…).
  const exact = EXACT.filter((column) => filters[column]).map((column) => eb(column, '=', filters[column] as never));
  return [...direction(eb, filters), ...exact, ...proposal(filters)];
}

/** Направление задано прямо либо выводится из типа платежа. */
function direction(eb: PaymentExpression, filters: InternalPaymentFiltersDomainInterface): Condition[] {
  const value = filters.direction ?? (filters.type ? getPaymentDirection(filters.type) : undefined);
  return value ? [eb('direction', '=', value as never)] : [];
}

/** Платежи расхода: хэш служебной записки лежит в данных цепи у платежа. */
function proposal(filters: InternalPaymentFiltersDomainInterface): Condition[] {
  if (!filters.proposal_hash) return [];
  return [sql<boolean>`blockchain_data ->> 'proposal_hash' = ${filters.proposal_hash.toLowerCase()}`];
}

function toDomain(row: Row): PaymentDomainInterface {
  // Бессрочный платёж хранится с датой «-1 мс»: наружу он уходит без срока.
  const expiredAt = row.expired_at?.getTime() === -1 ? undefined : orUndefined(row.expired_at);
  return {
    id: row.id,
    hash: row.hash,
    coopname: row.coopname,
    username: row.username,
    // Сумма с копейками: numeric приходит из базы строкой.
    quantity: Number(row.quantity),
    symbol: row.symbol,
    payment_method_id: orUndefined(row.payment_method_id),
    status: row.status as PaymentDomainInterface['status'],
    type: row.type as PaymentDomainInterface['type'],
    direction: row.direction as PaymentDomainInterface['direction'],
    provider: orUndefined(row.provider),
    secret: orUndefined(row.secret),
    message: orUndefined(row.message),
    expired_at: expiredAt,
    completed_at: orUndefined(row.completed_at),
    failed_at: orUndefined(row.failed_at),
    created_at: row.created_at,
    updated_at: orUndefined(row.updated_at),
    memo: orUndefined(row.memo),
    payment_details: orUndefined(row.payment_details) as PaymentDomainInterface['payment_details'],
    blockchain_data: orUndefined(row.blockchain_data) as PaymentDomainInterface['blockchain_data'],
    statement: orUndefined(row.statement) as PaymentDomainInterface['statement'],
  };
}

/** Колонки платежа из доменного объекта. */
function toColumns(data: PaymentDomainInterface) {
  return {
    hash: data.hash,
    coopname: data.coopname,
    username: data.username,
    quantity: data.quantity,
    symbol: data.symbol,
    payment_method_id: orNull(data.payment_method_id),
    status: data.status as Row['status'],
    type: data.type as Row['type'],
    direction: data.direction as Row['direction'],
    provider: orNull(data.provider),
    secret: orNull(data.secret),
    message: orNull(data.message),
    expired_at: orNull(data.expired_at),
    memo: orNull(data.memo),
    payment_details: json(data.payment_details),
    blockchain_data: json(data.blockchain_data),
    statement: json(data.statement),
  };
}

/** Платежи кооператива (таблица `payments`). */
@Injectable()
export class PaymentKyselyRepository implements PaymentRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findById(id: string): Promise<PaymentDomainInterface | null> {
    const row = await this.db.selectFrom('payments').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByHash(hash: string): Promise<PaymentDomainInterface | null> {
    const row = await this.db.selectFrom('payments').selectAll().where('hash', '=', hash).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db.deleteFrom('payments').where('id', '=', id).returningAll().execute();
    return rows.length > 0;
  }

  async create(data: PaymentDomainInterface): Promise<PaymentDomainInterface> {
    const row = await this.db
      .insertInto('payments')
      .values({ ...toColumns(data), ...(data.created_at ? { created_at: data.created_at } : {}) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async update(id: string, data: Partial<PaymentDomainInterface>): Promise<PaymentDomainInterface | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const now = new Date();
    // Правятся только переданные поля: незаданное поле прежнее значение не затирает.
    const given = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    // Смена статуса сама проставляет дату завершения либо отказа.
    return this.write(id, { ...current, ...given, ...outcomeDates(data.status, now) }, now);
  }

  async updatePaymentWithBlockchainData(hash: string, blockchain_data: any): Promise<PaymentDomainInterface | null> {
    const row = await this.db
      .updateTable('payments')
      .set({ blockchain_data: json(blockchain_data), updated_at: new Date() })
      .where('hash', '=', hash)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async setPaymentStatus(id: string, status: PaymentStatusEnum): Promise<PaymentDomainInterface | null> {
    return this.update(id, { status });
  }

  /** Реестр платежей с отбором, новые сверху. */
  async getAllPayments(
    filters: InternalPaymentFiltersDomainInterface,
    options: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<PaymentDomainInterface>> {
    const query = this.db.selectFrom('payments').where((eb) => eb.and(conditions(eb, filters)));
    const limit = options.limit || 10;
    const page = options.page || 1;

    const rows = await query
      .selectAll()
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);

    return { items: rows.map(toDomain), totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page };
  }

  /** Просроченные ожидающие платежи переводятся в «истёк»; возвращает их число. */
  async expireOutdatedPayments(): Promise<number> {
    const now = new Date();
    const rows = await this.db
      .updateTable('payments')
      .set({ status: PaymentStatusEnum.EXPIRED as Row['status'], updated_at: now })
      .where('expired_at', 'is not', null)
      .where('expired_at', '<', now)
      .where('status', '=', PaymentStatusEnum.PENDING as Row['status'])
      .returningAll()
      .execute();
    return rows.length;
  }

  /** Ожидающий непросроченный платёж того же вида и суммы у пайщика. */
  async findActivePendingPayment(
    username: string,
    type: PaymentTypeEnum,
    quantity: number,
    symbol: string
  ): Promise<PaymentDomainInterface | null> {
    const row = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('username', '=', username)
      .where('type', '=', type as Row['type'])
      .where('quantity', '=', String(quantity))
      .where('symbol', '=', symbol)
      .where('status', '=', PaymentStatusEnum.PENDING as Row['status'])
      .where((eb) => eb.or([eb('expired_at', 'is', null), eb('expired_at', '>', new Date())]))
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findLatestByUsernameAndType(username: string, type: PaymentTypeEnum): Promise<PaymentDomainInterface | null> {
    const row = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('username', '=', username)
      .where('type', '=', type as Row['type'])
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  private async write(id: string, data: PaymentDomainInterface, now: Date): Promise<PaymentDomainInterface | null> {
    const row = await this.db
      .updateTable('payments')
      .set({
        ...toColumns(data),
        completed_at: orNull(data.completed_at),
        failed_at: orNull(data.failed_at),
        updated_at: now,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
