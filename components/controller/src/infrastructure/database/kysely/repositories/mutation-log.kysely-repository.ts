import { Inject, Injectable } from '@nestjs/common';
import type { Expression, ExpressionBuilder, Selectable, SqlBool } from 'kysely';
import { PaginationUtils } from '@coopenomics/extension-kit';
import type { MutationLogRepository } from '~/domain/mutation-log/repositories/mutation-log.repository';
import type { MutationLogDomainEntity } from '~/domain/mutation-log/entities/mutation-log-domain.entity';
import type {
  IMutationLogFilterDomainInterface,
  ICreateMutationLogDomainInterface,
} from '~/domain/mutation-log/interfaces/mutation-log-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { DB, MutationLogs } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

type LogExpression = ExpressionBuilder<DB, 'mutation_logs'>;

/** Условия отбора журнала: точные совпадения, имена мутаций и отрезок времени. */
function conditions(eb: LogExpression, filter: IMutationLogFilterDomainInterface): Expression<SqlBool>[] {
  const exact = (['coopname', 'username', 'status'] as const)
    .filter((column) => filter[column])
    .map((column) => eb(column, '=', filter[column] as string));
  return [...exact, ...mutationNames(eb, filter), ...period(eb, filter)];
}

/** Перечень имён важнее одного имени — так же, как было. */
function mutationNames(eb: LogExpression, filter: IMutationLogFilterDomainInterface): Expression<SqlBool>[] {
  if (filter.mutation_names && filter.mutation_names.length > 0) return [eb('mutation_name', 'in', filter.mutation_names)];
  return filter.mutation_name ? [eb('mutation_name', '=', filter.mutation_name)] : [];
}

function period(eb: LogExpression, filter: IMutationLogFilterDomainInterface): Expression<SqlBool>[] {
  if (!filter.date_from && !filter.date_to) return [];
  return [eb('created_at', '>=', filter.date_from || new Date(0)), eb('created_at', '<=', filter.date_to || new Date())];
}

/** Журнал мутаций API (таблица `mutation_logs`). */
@Injectable()
export class MutationLogKyselyRepository implements MutationLogRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(log: ICreateMutationLogDomainInterface): Promise<MutationLogDomainEntity> {
    const row = await this.db
      .insertInto('mutation_logs')
      .values({
        coopname: log.coopname ?? null,
        mutation_name: log.mutation_name,
        username: log.username,
        arguments: JSON.stringify(log.arguments),
        duration_ms: log.duration_ms,
        status: log.status,
        error_message: log.error_message ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async findById(id: string): Promise<MutationLogDomainEntity | null> {
    const row = await this.db.selectFrom('mutation_logs').selectAll().where('_id', '=', id).executeTakeFirst();
    return row ? this.toDomain(row) : null;
  }

  /** Журнал с отбором, новые сверху. */
  async findAll(
    filter?: IMutationLogFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    const query = this.db.selectFrom('mutation_logs').where((eb) => eb.and(conditions(eb, filter ?? {})));

    const { page = 1, limit = 10 } = options || {};
    const rows = await query
      .selectAll()
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();

    return PaginationUtils.createPaginationResult(
      rows.map((row) => this.toDomain(row)),
      Number(total.count),
      { page, limit, sortOrder: 'DESC' }
    );
  }

  async findByMutationName(
    mutationName: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    return this.findAll({ mutation_name: mutationName }, options);
  }

  async findByUsername(
    username: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MutationLogDomainEntity>> {
    return this.findAll({ username }, options);
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom('mutation_logs').where('_id', '=', id).execute();
  }

  private toDomain(row: Selectable<MutationLogs>): MutationLogDomainEntity {
    return {
      _id: row._id,
      coopname: row.coopname ?? undefined,
      mutation_name: row.mutation_name,
      username: row.username,
      arguments: row.arguments as Record<string, any>,
      duration_ms: row.duration_ms,
      status: row.status as 'success' | 'error',
      error_message: row.error_message ?? undefined,
      created_at: row.created_at,
    } as MutationLogDomainEntity;
  }
}
