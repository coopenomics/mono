import type { Pool } from 'pg';
import { extensionDatabaseMigrations, type SchemaMigration, type SchemaMigrationClass } from '@coopenomics/extension-kit';
import { coreDatabaseMigrations } from '../migrations';

/** Таблица учёта применённых миграций схемы. `migrations` занята мигратором данных. */
export const DATABASE_MIGRATIONS_TABLE = 'schema_migrations';

interface NamedMigration {
  name: string;
  timestamp: number;
  migration: SchemaMigration;
}

/** Имя миграции оканчивается меткой времени — по ней миграции идут в ленте. */
function named(migrationClass: SchemaMigrationClass): NamedMigration {
  const migration = new migrationClass();
  const name = migration.name ?? migrationClass.name;
  const timestamp = Number.parseInt(name.slice(-13), 10);
  if (!Number.isFinite(timestamp)) throw new Error(`Schema migration ${name} has no timestamp in its name`);
  return { name, timestamp, migration };
}

/**
 * Лента миграций схемы: ядро и установленные расширения, от ранних к поздним.
 * Состав расширений читается из реестра, поэтому функцию зовут после того,
 * как composition root его заполнил (импорт `extensions.registry`).
 */
export function schemaMigrations(): NamedMigration[] {
  return [...coreDatabaseMigrations, ...extensionDatabaseMigrations()].map(named).sort((a, b) => a.timestamp - b.timestamp);
}

async function appliedNames(pool: Pool): Promise<Set<string>> {
  // Вид таблицы — как у прежнего учёта: узлы, где миграции уже применены, продолжают с того же места.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${DATABASE_MIGRATIONS_TABLE}" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" character varying NOT NULL)`
  );
  const applied = await pool.query<{ name: string }>(`SELECT "name" FROM "${DATABASE_MIGRATIONS_TABLE}"`);
  return new Set(applied.rows.map((row) => row.name));
}

/** Имена миграций схемы, которые в базе ещё не применены. */
export async function pendingSchemaMigrations(pool: Pool): Promise<string[]> {
  const applied = await appliedNames(pool);
  return schemaMigrations()
    .filter((item) => !applied.has(item.name))
    .map((item) => item.name);
}

/**
 * Применяет непринятые миграции схемы (таблицы, колонки, индексы).
 *
 * Каждая миграция — в своей транзакции вместе с записью об её применении:
 * упавшая откатывается целиком и не оставляет базу наполовину изменённой, а
 * принятые до неё остаются принятыми.
 *
 * @returns Имена применённых миграций (пусто, если нечего применять).
 */
export async function runSchemaMigrations(pool: Pool, onApplied?: (name: string, index: number, total: number) => void): Promise<string[]> {
  const applied = await appliedNames(pool);
  const pending = schemaMigrations().filter((item) => !applied.has(item.name));
  for (const [index, item] of pending.entries()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await item.migration.up({ query: async (sql, parameters) => (await client.query(sql, parameters)).rows });
      await client.query(`INSERT INTO "${DATABASE_MIGRATIONS_TABLE}" ("timestamp", "name") VALUES ($1, $2)`, [item.timestamp, item.name]);
      await client.query('COMMIT');
      onApplied?.(item.name, index + 1, pending.length);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return pending.map((item) => item.name);
}
