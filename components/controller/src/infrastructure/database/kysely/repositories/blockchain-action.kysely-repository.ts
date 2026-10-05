import { Inject, Injectable } from '@nestjs/common';
import { sql, type Expression, type ExpressionBuilder, type Selectable, type SqlBool } from 'kysely';
import type { ActionRepositoryPort } from '~/domain/parser/ports/action-repository.port';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type {
  ActionFilterDomainInterface,
  PaginatedResultDomainInterface,
} from '~/domain/parser/interfaces/parser-config-domain.interface';
import { parseChainBlockTime } from '~/infrastructure/blockchain/block-time.util';
import { isHexHash } from '~/shared/sql/hex-value.util';
import type { BlockchainActions, DB } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

type ActionExpression = ExpressionBuilder<DB, 'blockchain_actions'>;
type Condition = Expression<SqlBool>;

/** Строка журнала действий в форме действия цепи: номер блока — число, время блока — строка ISO. */
export function toAction(row: Selectable<BlockchainActions>): ActionDomainInterface {
  return {
    ...row,
    block_num: Number(row.block_num),
    block_time: row.block_time ? row.block_time.toISOString() : undefined,
    console: row.console ?? undefined,
  } as unknown as ActionDomainInterface;
}

const EXACT = ['account', 'name', 'receiver', 'global_sequence'] as const;

/** Условия отбора журнала действий. */
function conditions(eb: ActionExpression, filter: ActionFilterDomainInterface): Condition[] {
  const exact = EXACT.filter((column) => filter[column]).map((column) => eb(column, '=', String(filter[column])));
  const block = filter.block_num ? [eb('block_num', '=', String(filter.block_num))] : [];
  const repeat = filter.repeat !== undefined ? [eb('repeat', '=', filter.repeat)] : [];
  return [...exact, ...block, ...repeat, ...Object.entries(filter.data ?? {}).map(dataCondition)];
}

/**
 * Поле полезной нагрузки сравнивается как текст: число из цепи и его строковая
 * запись совпадают одинаково. Ключ с точками — путь вглубь (`document.hash`).
 * Хэш сравнивается без учёта регистра — см. isHexHash.
 */
function dataCondition([field, value]: [string, unknown]): Condition {
  const path = field.split('.');
  const text = String(value);
  const hex = isHexHash(text);
  const expression = path.length === 1 ? sql`data ->> ${field}` : sql`data #>> ${`{${path.join(',')}}`}::text[]`;
  return hex ? sql<boolean>`lower(${expression}) = ${text.toLowerCase()}` : sql<boolean>`${expression} = ${text}`;
}

/** Журнал действий цепи (таблица `blockchain_actions`). */
@Injectable()
export class BlockchainActionKyselyRepository implements ActionRepositoryPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  /**
   * Сохранение действия. Номер `global_sequence` уникален в истории цепи:
   * повторная доставка того же действия (переигровка стрима) возвращает уже
   * сохранённое, иначе потребитель не подтвердил бы сообщение и зациклился.
   */
  async save(actionData: Omit<ActionDomainInterface, 'id' | 'created_at'>): Promise<ActionDomainInterface> {
    const data = actionData as unknown as Record<string, unknown>;
    const inserted = await this.db
      .insertInto('blockchain_actions')
      .values({
        transaction_id: actionData.transaction_id,
        account: actionData.account,
        block_num: actionData.block_num,
        block_id: actionData.block_id,
        block_time: parseChainBlockTime(actionData.block_time),
        chain_id: actionData.chain_id,
        name: actionData.name,
        receiver: actionData.receiver,
        authorization: JSON.stringify(actionData.authorization),
        data: JSON.stringify(actionData.data),
        action_ordinal: actionData.action_ordinal,
        global_sequence: String(actionData.global_sequence),
        account_ram_deltas: JSON.stringify(actionData.account_ram_deltas),
        console: (data.console as string | undefined) ?? null,
        receipt: JSON.stringify(actionData.receipt),
        creator_action_ordinal: actionData.creator_action_ordinal,
        context_free: actionData.context_free,
        elapsed: actionData.elapsed,
        ...(data.repeat !== undefined ? { repeat: data.repeat as boolean } : {}),
      })
      .onConflict((conflict) => conflict.column('global_sequence').doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return toAction(inserted);

    const existing = await this.db
      .selectFrom('blockchain_actions')
      .selectAll()
      .where('global_sequence', '=', String(actionData.global_sequence))
      .executeTakeFirstOrThrow();
    return toAction(existing);
  }

  /** Журнал действий с отбором, от последних блоков к первым. */
  async findMany(
    filter: ActionFilterDomainInterface,
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<ActionDomainInterface>> {
    const query = this.db.selectFrom('blockchain_actions').where((eb) => eb.and(conditions(eb, filter)));
    const rows = await query
      .selectAll()
      .orderBy('block_num', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return { results: rows.map(toAction), page, limit, total: Number(total.count) };
  }

  async findById(id: string): Promise<ActionDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_actions').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toAction(row) : null;
  }

  async deleteAfterBlock(blockNum: number): Promise<void> {
    await this.db.deleteFrom('blockchain_actions').where('block_num', '>', String(blockNum)).execute();
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('blockchain_actions')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async findLastByBlock(): Promise<ActionDomainInterface | null> {
    const row = await this.db.selectFrom('blockchain_actions').selectAll().orderBy('block_num', 'desc').limit(1).executeTakeFirst();
    return row ? toAction(row) : null;
  }

  async findRepeatableActions(): Promise<ActionDomainInterface[]> {
    const rows = await this.db
      .selectFrom('blockchain_actions')
      .selectAll()
      .where('repeat', '=', true)
      .orderBy('created_at', 'asc')
      .execute();
    return rows.map(toAction);
  }

  async resetRepeatFlag(id: string): Promise<void> {
    await this.db.updateTable('blockchain_actions').set({ repeat: false }).where('id', '=', id).execute();
  }
}
