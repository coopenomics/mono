import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, affectedCount } from '../database/kysely';
import type { TableStore, Where } from '../database/table-store';
import { moreThan } from '../database/table-store';
import { inTransaction } from '../database/transaction';
import type { IBaseDatabaseData } from './base-database.interface';

interface VersionRow {
  id: string;
  entity_table: string;
  entity_id: string;
  previous_data: Record<string, unknown> | null;
  block_num: number | null;
  change_type: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Версии записей зеркал цепи и архив форка — на Kysely.
 *
 * Перед каждым изменением записи её прежнее состояние кладётся в
 * `entity_versions` вместе с блоком изменения. При форке цепи записи
 * возвращаются к состоянию на блоке форка, а всё, что форк отменил, уходит в
 * архив `invalidated_*`.
 */
@Injectable()
export class ChainVersioningService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(@Inject(KYSELY) private readonly db: Kysely<any>) {}

  /** Кладёт в версии состояние записи перед её изменением; новой записи версионировать нечего. */
  async saveVersionBeforeUpdate<TRecord extends IBaseDatabaseData>(
    store: TableStore<TRecord>,
    updated: Partial<TRecord>,
    blockNum: number | null,
    changeType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Без ключа искать нечего: отбор без условия вернул бы чужую запись.
    if (!updated._id) return;
    const existing = await store.findOne({ _id: updated._id } as Where<TRecord>);
    if (!existing) return;
    await this.db
      .insertInto('entity_versions')
      .values({
        entity_table: store.table,
        entity_id: existing._id,
        previous_data: JSON.stringify(existing),
        block_num: blockNum,
        change_type: changeType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .execute();
  }

  /**
   * Возвращает записи таблицы к состоянию на блоке форка.
   *
   * Версия хранит состояние записи ДО изменения и блок самого изменения. После
   * форка недействительны изменения с блоком больше блока форка, поэтому для
   * каждой записи берётся самое раннее такое изменение: состояние перед ним и
   * есть состояние на блоке форка. Запись без изменений после форка остаётся
   * как есть.
   */
  async restoreVersionsAfterFork<TRecord extends IBaseDatabaseData>(store: TableStore<TRecord>, forkBlockNum: number): Promise<void> {
    const invalidated = (await this.db
      .selectFrom('entity_versions')
      .selectAll()
      .where('entity_table', '=', store.table)
      .where('block_num', '>', forkBlockNum)
      .orderBy('entity_id', 'asc')
      .orderBy('block_num', 'asc')
      .orderBy('created_at', 'asc')
      .execute()) as VersionRow[];

    const firstInvalidated = new Map<string, VersionRow>();
    for (const version of invalidated) {
      if (!firstInvalidated.has(version.entity_id)) firstInvalidated.set(version.entity_id, version);
    }

    for (const [entityId, version] of firstInvalidated) {
      const state = version.previous_data;
      if (!state || appearedAfter(state, forkBlockNum)) continue;
      const existing = await store.findOne({ _id: entityId } as Where<TRecord>);
      await store.save(Object.assign(existing ?? {}, state) as Partial<TRecord>);
    }
  }

  /**
   * Переносит записи таблицы с блоком больше блока форка в архив
   * `invalidated_entities` и убирает их из таблицы — одной транзакцией.
   * Возвращает число перенесённых записей.
   */
  async archiveAndDeleteLiveAfterFork<TRecord extends IBaseDatabaseData>(
    store: TableStore<TRecord>,
    forkBlockNum: number,
    forkEventId?: string | null
  ): Promise<number> {
    return inTransaction(this.db, async (trx) => {
      const live = store.on(trx);
      const rows = await live.find({ block_num: moreThan(forkBlockNum) } as Where<TRecord>);
      if (rows.length === 0) return 0;
      await trx
        .insertInto('invalidated_entities')
        .values(
          rows.map((row) => ({
            entity_table: store.table,
            entity_id: row._id,
            data: JSON.stringify(row),
            invalidated_by_block: forkBlockNum,
            fork_event_id: forkEventId ?? null,
          }))
        )
        .execute();
      await live.delete({ block_num: moreThan(forkBlockNum) } as Where<TRecord>);
      return rows.length;
    });
  }

  /**
   * Чистит архив форка: записи и версии, отменённые блоком раньше заданного.
   * Возвращает число удалённых записей и версий.
   */
  async deleteArchiveOlderThan(minInvalidatedByBlock: number): Promise<{ entities: number; versions: number }> {
    const entities = await this.db.deleteFrom('invalidated_entities').where('invalidated_by_block', '<', minInvalidatedByBlock).execute();
    const versions = await this.db
      .deleteFrom('invalidated_entity_versions')
      .where('invalidated_by_block', '<', minInvalidatedByBlock)
      .execute();
    return { entities: affectedCount(entities), versions: affectedCount(versions) };
  }

  /**
   * Переносит версии таблицы с блоком больше блока форка в архив
   * `invalidated_entity_versions` и убирает их из `entity_versions` — одной
   * транзакцией. Зовётся ПОСЛЕ восстановления: оно читает эти версии.
   */
  async archiveAndDeleteVersionsAfterFork(entityTable: string, forkBlockNum: number, forkEventId?: string | null): Promise<number> {
    return inTransaction(this.db, async (trx) => {
      const versions = (await trx
        .selectFrom('entity_versions')
        .selectAll()
        .where('entity_table', '=', entityTable)
        .where('block_num', '>', forkBlockNum)
        .execute()) as VersionRow[];
      if (versions.length === 0) return 0;
      await trx
        .insertInto('invalidated_entity_versions')
        .values(
          versions.map((version) => ({
            entity_table: version.entity_table,
            entity_id: version.entity_id,
            previous_data: JSON.stringify(version.previous_data),
            original_block_num: version.block_num ?? null,
            invalidated_by_block: forkBlockNum,
            fork_event_id: forkEventId ?? null,
            change_type: version.change_type,
            metadata: version.metadata ? JSON.stringify(version.metadata) : null,
          }))
        )
        .execute();
      await trx
        .deleteFrom('entity_versions')
        .where(
          'id',
          'in',
          versions.map((version) => version.id)
        )
        .execute();
      return versions.length;
    });
  }
}

/** Запись появилась уже после форка: на блоке форка её не было, возвращать нечего. */
function appearedAfter(state: Record<string, unknown>, forkBlockNum: number): boolean {
  const block = state.block_num;
  return block !== null && block !== undefined && Number(block) > forkBlockNum;
}
