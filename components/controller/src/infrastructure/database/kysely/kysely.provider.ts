import type { Provider } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import { MAIN_DATABASE, configureLocalChangePublisher, pendingLocalChanges, type MainDatabase } from '@coopenomics/extension-kit';
import logger from '~/config/logger';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';
import { createMainPool } from '../postgres/postgres-connection';
import { runSchemaMigrations } from '../schema/schema-migrations';
import type { DB } from './database.types';
import { KYSELY, type Database } from './kysely.tokens';
import { LocalChangesPlugin, type LocalChange } from './local-changes.plugin';

/** Пул соединений основной базы кооператива — один на процесс. */
export const PG_POOL = Symbol('Controller.Database.PgPool');

/** Лента изменений и ключи таблиц — общие для всех экземпляров Kysely процесса. */
interface Feed {
  isWatched(table: string): boolean;
  primaryKeyOf(table: string): string[];
  publish(change: LocalChange): void;
}

let feed: Feed | undefined;

function plugins(sink: (change: LocalChange) => void): LocalChangesPlugin[] {
  if (!feed) return [];
  return [new LocalChangesPlugin(feed.isWatched, feed.primaryKeyOf, sink)];
}

/** Kysely поверх пула соединений основной базы. Пул закрывает его владелец. */
export function createKysely(pool: Pool): Database {
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

/** Первичные ключи таблиц: по ним лента называет изменённую строку. */
async function loadPrimaryKeys(pool: Pool): Promise<Map<string, string[]>> {
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT kcu.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = current_schema()
      ORDER BY kcu.table_name, kcu.ordinal_position`
  );
  const keys = new Map<string, string[]>();
  for (const row of result.rows) keys.set(row.table_name, [...(keys.get(row.table_name) ?? []), row.column_name]);
  return keys;
}

/**
 * Пул основной базы. Схема — только миграциями: новые применяются при
 * подключении, до того как поднимутся модули, читающие таблицы.
 */
export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  useFactory: async (): Promise<Pool> => {
    const pool = createMainPool();
    await runSchemaMigrations(pool, (name, index, total) => logger.info(`Миграция схемы [${index}/${total}]: ${name}`));
    return pool;
  },
};

export const kyselyProvider: Provider = {
  provide: KYSELY,
  inject: [PG_POOL, ChainChangesService],
  useFactory: async (pool: Pool, changes: ChainChangesService): Promise<Database> => {
    const primaryKeys = await loadPrimaryKeys(pool);
    feed = {
      isWatched: (table) => Boolean(changes.localTableOf(table)),
      primaryKeyOf: (table) => primaryKeys.get(table) ?? [],
      publish: (change) => void changes.publishLocal(change.table, change.primary_key, change.row),
    };
    // Транзакции Kysely (`inTransaction` из каркаса) публикуют накопленное после фиксации.
    configureLocalChangePublisher((change) => feed?.publish(change));
    return createKysely(pool);
  },
};

/**
 * Основная база для готовых запросов конфигурационных миграций расширений —
 * ответ в прежнем виде (у правки и удаления пара «строки и число затронутых»).
 */
export const mainDatabaseProvider: Provider = {
  provide: MAIN_DATABASE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): MainDatabase => ({
    query: async (sql, parameters) => {
      const result = await pool.query(sql, parameters);
      return result.command === 'UPDATE' || result.command === 'DELETE' ? [result.rows, result.rowCount ?? 0] : result.rows;
    },
  }),
};
