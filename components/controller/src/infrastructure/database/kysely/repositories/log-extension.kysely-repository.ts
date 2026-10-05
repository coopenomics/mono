import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { LogExtensionDomainRepository, LogExtensionDomainEntity } from '@coopenomics/extension-kit';
import type {
  LogExtensionFilter,
  LogExtensionPaginationOptions,
  LogExtensionPaginationResult,
} from '@coopenomics/extension-kit';
import type { ExtensionsLogs } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';
import { sortColumn, sortDirection } from '@coopenomics/extension-kit';

/** Колонки, по которым журнал расширений можно сортировать. */
export const LOG_EXTENSION_SORT_COLUMNS = ['id', 'name', 'extension_local_id', 'created_at', 'updated_at'] as const;

/** Журнал расширений (таблица `extensions_logs`). */
@Injectable()
export class LogExtensionKyselyRepository<TLog = any> implements LogExtensionDomainRepository<TLog> {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async push(name: string, data: TLog): Promise<LogExtensionDomainEntity<TLog>> {
    // Номер записи внутри расширения — следующий за наибольшим.
    const last = await this.db
      .selectFrom('extensions_logs')
      .select((eb) => eb.fn.max('extension_local_id').as('max'))
      .where('name', '=', name)
      .executeTakeFirst();
    const row = await this.db
      .insertInto('extensions_logs')
      .values({ name, extension_local_id: Number(last?.max ?? 0) + 1, data: JSON.stringify(data) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.toDomain(row);
  }

  async get(): Promise<LogExtensionDomainEntity<TLog>[]> {
    const rows = await this.db.selectFrom('extensions_logs').selectAll().execute();
    return rows.map((row) => this.toDomain(row));
  }

  async getWithFilter(
    filter?: LogExtensionFilter,
    options?: LogExtensionPaginationOptions
  ): Promise<LogExtensionPaginationResult<TLog>> {
    let query = this.db.selectFrom('extensions_logs');
    if (filter?.name) query = query.where('name', '=', filter.name);
    if (filter?.createdFrom) query = query.where('created_at', '>=', filter.createdFrom);
    if (filter?.createdTo) query = query.where('created_at', '<=', filter.createdTo);

    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const rows = await query
      .selectAll()
      .orderBy(sortColumn(LOG_EXTENSION_SORT_COLUMNS, options?.sortBy, 'created_at'), sortDirection(options?.sortOrder))
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();

    return {
      items: rows.map((row) => this.toDomain(row)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  private toDomain(row: Selectable<ExtensionsLogs>): LogExtensionDomainEntity<TLog> {
    return new LogExtensionDomainEntity<TLog>(
      row.id,
      row.name,
      row.extension_local_id,
      row.data as unknown as TLog,
      row.created_at,
      row.updated_at
    );
  }
}
