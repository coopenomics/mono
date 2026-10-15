import { Inject, Injectable } from '@nestjs/common';
import { sql, type Expression, type ExpressionBuilder, type Selectable, type SqlBool } from 'kysely';
import type { DeltaRepositoryPort } from '~/domain/parser/ports/delta-repository.port';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import type {
  DeltaFilterDomainInterface,
  PaginatedResultDomainInterface,
} from '~/domain/parser/interfaces/parser-config-domain.interface';
import type { TableStateDomainInterface } from '~/domain/parser/interfaces/table-state-domain.interface';
import { parseChainBlockTime } from '~/infrastructure/blockchain/block-time.util';
import type { BlockchainDeltas, DB } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

type DeltaExpression = ExpressionBuilder<DB, 'blockchain_deltas'>;
type Condition = Expression<SqlBool>;
type TableFilter = { code?: string; scope?: string; table?: string };

/** Строка журнала дельт в форме дельты цепи: номер блока — число, время блока — строка ISO. */
export function toDelta(row: Selectable<BlockchainDeltas>): DeltaDomainInterface {
  return {
    ...row,
    block_num: Number(row.block_num),
    block_time: row.block_time ? row.block_time.toISOString() : undefined,
    value: row.value ?? undefined,
  };
}

const jsonb = (value: unknown): string | null => (value === undefined ? null : JSON.stringify(value));

const TABLE_KEYS = ['code', 'scope', 'table'] as const;

/** Отбор по контракту, области и таблице. */
function tableConditions(eb: DeltaExpression, filter: TableFilter): Condition[] {
  return TABLE_KEYS.filter((column) => filter[column]).map((column) => eb(column, '=', filter[column] as string));
}

/** Условия отбора журнала дельт. */
function conditions(eb: DeltaExpression, filter: DeltaFilterDomainInterface): Condition[] {
  const exact = [...tableConditions(eb, filter), ...(filter.primary_key ? [eb('primary_key', '=', filter.primary_key)] : [])];
  const block = filter.block_num ? [eb('block_num', '=', String(filter.block_num))] : [];
  const flags = (['present', 'repeat'] as const)
    .filter((column) => filter[column] !== undefined)
    .map((column) => eb(column, '=', filter[column] as boolean));
  return [...exact, ...block, ...flags];
}

function toState(row: {
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  value: unknown;
  block_num: string | number;
  created_at: Date;
}): TableStateDomainInterface {
  return {
    code: row.code,
    scope: row.scope,
    table: row.table,
    primary_key: row.primary_key,
    value: row.value,
    block_num: row.block_num as number,
    created_at: row.created_at,
  };
}

/** Журнал изменений таблиц цепи (таблица `blockchain_deltas`). */
@Injectable()
export class BlockchainDeltaKyselyRepository implements DeltaRepositoryPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  /**
   * Сохранение дельты.
   *
   * Идемпотентно по естественному признаку записи: цепь, блок, контракт, область,
   * таблица, первичный ключ, признак присутствия и само значение. У дельт нет
   * сквозного номера, каким у действий служит global_sequence, поэтому повторная
   * доставка того же изменения — при переигровке стрима, при `repeat` и при
   * пересоздании группы потребителя — иначе клала бы в журнал второй экземпляр.
   *
   * Значение входит в признак намеренно: одна и та же строка таблицы может
   * меняться дважды в одном блоке (две транзакции), и это разные изменения,
   * которые обязаны сохраниться оба.
   */
  async save(deltaData: Omit<DeltaDomainInterface, 'id' | 'created_at'>): Promise<DeltaDomainInterface> {
    const value = jsonb(deltaData.value);
    const existing = await this.db
      .selectFrom('blockchain_deltas')
      .selectAll()
      .where('chain_id', '=', deltaData.chain_id)
      .where('block_num', '=', String(deltaData.block_num))
      .where('code', '=', deltaData.code)
      .where('scope', '=', deltaData.scope)
      .where('table', '=', deltaData.table)
      .where('primary_key', '=', deltaData.primary_key)
      .where('present', '=', deltaData.present)
      .where(sql<boolean>`value IS NOT DISTINCT FROM CAST(${value} AS jsonb)`)
      .limit(1)
      .executeTakeFirst();
    if (existing) return toDelta(existing);

    const row = await this.db
      .insertInto('blockchain_deltas')
      .values({
        chain_id: deltaData.chain_id,
        block_num: deltaData.block_num,
        block_id: deltaData.block_id,
        block_time: parseChainBlockTime(deltaData.block_time),
        present: deltaData.present,
        code: deltaData.code,
        scope: deltaData.scope,
        table: deltaData.table,
        primary_key: deltaData.primary_key,
        value,
        ...(deltaData.repeat !== undefined ? { repeat: deltaData.repeat } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDelta(row);
  }

  /** Журнал дельт с отбором, от последних блоков к первым. */
  async findMany(
    filter: DeltaFilterDomainInterface,
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<DeltaDomainInterface>> {
    const query = this.db.selectFrom('blockchain_deltas').where((eb) => eb.and(conditions(eb, filter)));
    const rows = await query
      .selectAll()
      .orderBy('block_num', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return { results: rows.map(toDelta), page, limit, total: Number(total.count) };
  }

  async findById(id: string): Promise<DeltaDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_deltas').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDelta(row) : null;
  }

  async deleteAfterBlock(blockNum: number): Promise<void> {
    await this.db.deleteFrom('blockchain_deltas').where('block_num', '>', String(blockNum)).execute();
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('blockchain_deltas')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async findLastByBlock(): Promise<DeltaDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_deltas').selectAll().orderBy('block_num', 'desc').limit(1).executeTakeFirst();
    return row ? toDelta(row) : null;
  }

  /**
   * Текущее состояние таблиц: по каждой строке берётся последнее изменение;
   * строка, чьё последнее изменение — удаление, не отдаётся.
   */
  async findCurrentTableStates(filters: TableFilter = {}): Promise<TableStateDomainInterface[]> {
    const rows = await this.latest(filters).execute();
    return rows.filter((row) => row.present === true).map(toState);
  }

  /** То же постранично: в счёт и на страницы идут только существующие строки. */
  async findCurrentTableStatesPaginated(
    filters: TableFilter = {},
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<TableStateDomainInterface>> {
    const query = this.db
      .with('latest', () => this.latest(filters, true))
      .selectFrom('latest')
      .select(['code', 'scope', 'table', 'primary_key', 'value', 'block_num', 'created_at'])
      .select((eb) => eb.fn.countAll<string>().over().as('total_count'))
      .orderBy('code')
      .orderBy('scope')
      .orderBy('table')
      .orderBy('primary_key')
      .offset((page - 1) * limit)
      .limit(limit);
    const rows = await query.execute();
    if (rows.length === 0) return { results: [], page, limit, total: 0 };
    return { results: rows.map(toState), page, limit, total: Number(rows[0].total_count) };
  }

  /**
   * Последние изменения строк одной таблицы с условиями по полям значения
   * (сравнение без учёта регистра). Имена полей задаёт код, не пайщик.
   */
  async findLatestRows(
    filters: { code: string; scope: string; table: string },
    where: Record<string, string> = {}
  ): Promise<{ primary_key: string; value: any; present: boolean; block_num: number }[]> {
    const byValue = Object.entries(where).map(([field, value]) => {
      if (!/^[a-z_][a-z0-9_]*$/.test(field)) throw new Error(`Invalid field name: ${field}`);
      return sql<boolean>`lower(value ->> ${field}) = ${value.toLowerCase()}`;
    });
    const rows = await this.db
      .selectFrom('blockchain_deltas')
      .distinctOn('primary_key')
      .select(['primary_key', 'value', 'present', 'block_num'])
      .where('code', '=', filters.code)
      .where('scope', '=', filters.scope)
      .where('table', '=', filters.table)
      .where((eb) => eb.and(byValue))
      .orderBy('primary_key')
      .orderBy('block_num', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, block_num: Number(row.block_num) }));
  }

  async findRepeatableDeltas(): Promise<DeltaDomainInterface[]> {
    const rows = await this.db
      .selectFrom('blockchain_deltas')
      .selectAll()
      .where('repeat', '=', true)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map(toDelta);
  }

  async resetRepeatFlag(id: string): Promise<void> {
    await this.db.updateTable('blockchain_deltas').set({ repeat: false }).where('id', '=', id).execute();
  }

  /** Последнее изменение каждой строки таблиц; `presentOnly` учитывает только изменения-существования. */
  private latest(filters: TableFilter, presentOnly = false) {
    return this.db
      .selectFrom('blockchain_deltas')
      .distinctOn(['code', 'scope', 'table', 'primary_key'])
      .select(['code', 'scope', 'table', 'primary_key', 'value', 'block_num', 'created_at', 'present'])
      .where((eb) => eb.and([...tableConditions(eb, filters), ...(presentOnly ? [eb('present', '=', true)] : [])]))
      .orderBy('code')
      .orderBy('scope')
      .orderBy('table')
      .orderBy('primary_key')
      .orderBy('block_num', 'desc');
  }
}
