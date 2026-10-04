import type { Provider } from '@nestjs/common';
import { Kysely, PostgresDialect, type PostgresPool } from 'kysely';
import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';
import type { DB } from './database.types';
import { BoundConnectionDialect, type PgQueryable } from './bound-connection.dialect';
import { KYSELY, type Database } from './kysely.tokens';
import { configureLocalChangePublisher, pendingLocalChanges } from '@coopenomics/extension-kit';
import { LocalChangesPlugin, type LocalChange } from './local-changes.plugin';

/** Лента изменений и ключи таблиц — общие для всех экземпляров Kysely процесса. */
interface Feed {
  isWatched(table: string): boolean;
  primaryKeyOf(table: string): string[];
  publish(change: LocalChange): void;
}

let feed: Feed | undefined;

/** Изменения, записанные через Kysely внутри транзакции TypeORM, — до её исхода. */
const pendingInTypeormTransaction = new WeakMap<QueryRunner, LocalChange[]>();

function plugins(sink: (change: LocalChange) => void): LocalChangesPlugin[] {
  if (!feed) return [];
  return [new LocalChangesPlugin(feed.isWatched, feed.primaryKeyOf, sink)];
}

/**
 * Kysely работает на том же пуле соединений, что и TypeORM: на время перехода
 * (C28-81) у базы один пул и один предел соединений. Пул закрывает TypeORM,
 * поэтому `destroy()` у этого экземпляра не зовут.
 */
export function createKysely(dataSource: DataSource): Database {
  const pool = (dataSource.driver as unknown as { master: PostgresPool }).master;
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
    // Вне транзакции запись уже зафиксирована — сигнал сразу; внутри
    // `inTransaction` (каркас расширения) — после фиксации.
    plugins: plugins((change) => {
      const pending = pendingLocalChanges.getStore();
      if (pending) pending.push(change);
      else feed?.publish(change);
    }),
  });
}

/**
 * Kysely на соединении транзакции TypeORM. Запросы обоих идут одной
 * транзакцией: фиксирует и откатывает её TypeORM.
 *
 * ```ts
 * await dataSource.transaction(async (manager) => {
 *   await manager.save(entity);
 *   await (await kyselyIn(manager)).insertInto('tracking_rules').values(row).execute();
 * });
 * ```
 */
export async function kyselyIn(manager: EntityManager): Promise<Database> {
  const runner = manager.queryRunner;
  if (!runner?.isTransactionActive) {
    throw new Error('kyselyIn: the manager has no active transaction');
  }
  const client = (await runner.connect()) as PgQueryable;
  return new Kysely<DB>({
    dialect: new BoundConnectionDialect(client),
    plugins: plugins((change) => {
      const list = pendingInTypeormTransaction.get(runner) ?? [];
      list.push(change);
      pendingInTypeormTransaction.set(runner, list);
    }),
  });
}

/** Первичные ключи таблиц: по ним лента называет изменённую строку. */
async function loadPrimaryKeys(dataSource: DataSource): Promise<Map<string, string[]>> {
  const rows: Array<{ table_name: string; column_name: string }> = await dataSource.query(
    `SELECT kcu.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = current_schema()
      ORDER BY kcu.table_name, kcu.ordinal_position`
  );
  const keys = new Map<string, string[]>();
  for (const row of rows) keys.set(row.table_name, [...(keys.get(row.table_name) ?? []), row.column_name]);
  return keys;
}

export const kyselyProvider: Provider = {
  provide: KYSELY,
  inject: [DataSource, ChainChangesService],
  useFactory: async (dataSource: DataSource, changes: ChainChangesService): Promise<Database> => {
    const primaryKeys = await loadPrimaryKeys(dataSource);
    feed = {
      isWatched: (table) => Boolean(changes.localTableOf(table)),
      primaryKeyOf: (table) => primaryKeys.get(table) ?? [],
      publish: (change) => void changes.publishLocal(change.table, change.primary_key, change.row),
    };
    // Транзакции Kysely (`inTransaction` из каркаса) публикуют накопленное после фиксации.
    configureLocalChangePublisher((change) => feed?.publish(change));
    // Исход транзакции TypeORM решает судьбу сигналов, записанных в ней через Kysely.
    dataSource.subscribers.push({
      afterTransactionCommit: (event) => {
        const list = pendingInTypeormTransaction.get(event.queryRunner);
        pendingInTypeormTransaction.delete(event.queryRunner);
        list?.forEach((change) => feed?.publish(change));
      },
      afterTransactionRollback: (event) => {
        pendingInTypeormTransaction.delete(event.queryRunner);
      },
    });
    return createKysely(dataSource);
  },
};
