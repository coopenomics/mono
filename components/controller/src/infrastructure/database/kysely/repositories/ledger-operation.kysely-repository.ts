import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { LedgerOperationRepository } from '~/domain/ledger/repositories/ledger-operation.repository';
import { LedgerOperationDomainEntity } from '~/domain/ledger/entities/ledger-operation-domain.entity';
import type { GetLedgerHistoryInputDomainInterface, LedgerHistoryResponseDomainInterface } from '~/domain/ledger/interfaces';
import type { LedgerOperations } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';
import { sortColumn, sortDirection } from '../sort';

/** Колонки, по которым историю операций можно сортировать. */
export const LEDGER_OPERATION_SORT_COLUMNS = ['created_at', 'global_sequence', 'action', 'account_id', 'username'] as const;

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

function toOperation(row: Selectable<LedgerOperations>) {
  return {
    global_sequence: Number(row.global_sequence),
    coopname: row.coopname,
    action: row.action,
    created_at: row.created_at,
    account_id: row.account_id === null ? undefined : Number(row.account_id),
    quantity: orUndefined(row.quantity),
    comment: orUndefined(row.comment),
    hash: orUndefined(row.hash),
    username: orUndefined(row.username),
  };
}

/** История операций прежнего ledger (таблица `ledger_operations`). */
@Injectable()
export class LedgerOperationKyselyRepository implements LedgerOperationRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  /** Повторная доставка операции с тем же номером перезаписывает её. */
  async save(operation: LedgerOperationDomainEntity): Promise<void> {
    const values = {
      global_sequence: operation.global_sequence,
      coopname: operation.coopname,
      action: operation.action,
      created_at: operation.created_at,
      account_id: operation.account_id ?? null,
      quantity: operation.quantity ?? null,
      comment: operation.comment ?? null,
      hash: operation.hash ?? null,
      username: operation.username ?? null,
    };
    await this.db
      .insertInto('ledger_operations')
      .values(values)
      .onConflict((conflict) => conflict.column('global_sequence').doUpdateSet(values))
      .execute();
  }

  async getHistory(params: GetLedgerHistoryInputDomainInterface): Promise<LedgerHistoryResponseDomainInterface> {
    let query = this.db.selectFrom('ledger_operations').where('coopname', '=', params.coopname);
    if (params.account_id !== undefined) query = query.where('account_id', '=', String(params.account_id));

    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);
    const page = params.page || 1;
    const limit = params.limit || 10;

    const rows = await query
      .selectAll()
      .orderBy(sortColumn(LEDGER_OPERATION_SORT_COLUMNS, params.sortBy, 'created_at'), sortDirection(params.sortOrder))
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();

    return {
      items: rows.map(toOperation),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    } as LedgerHistoryResponseDomainInterface;
  }

  async findByGlobalSequence(global_sequence: number): Promise<LedgerOperationDomainEntity | null> {
    const row = await this.db
      .selectFrom('ledger_operations')
      .selectAll()
      .where('global_sequence', '=', String(global_sequence))
      .executeTakeFirst();
    return row ? new LedgerOperationDomainEntity(toOperation(row) as ConstructorParameters<typeof LedgerOperationDomainEntity>[0]) : null;
  }
}
