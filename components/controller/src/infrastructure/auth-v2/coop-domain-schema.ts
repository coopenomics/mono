import { Pool } from 'pg';
import config from '~/config/config';
import { named, runSchemaMigrations } from '~/infrastructure/database/schema/schema-migrations';
import { COOP_DOMAIN_LEGACY_VERSIONS, coopDomainDatabaseMigrations } from './coop-domain-migrations';

/** Ключ advisory-блокировки схемы coop_domain_db (свой у каждой базы). */
export const COOP_DOMAIN_SCHEMA_LOCK = 7_301_202_611;

/** Пул базы CoopID на время применения схемы; закрывает его вызывающий. */
export function createCoopDomainPool(): Pool {
  return new Pool({
    host: config.coopDomainDb.host,
    port: config.coopDomainDb.port,
    user: config.coopDomainDb.username,
    password: config.coopDomainDb.password,
    database: config.coopDomainDb.database,
  });
}

/**
 * Версии миграций данных, успешно прошедших на узле (таблица `migrations`
 * основной базы). Таблицы нет — на чистом узле мигратор данных ещё не
 * запускался, — значит, переносить нечего.
 */
async function legacyAppliedVersions(mainPool: Pool): Promise<Set<string>> {
  const exists = await mainPool.query<{ exists: boolean }>(`SELECT to_regclass('migrations') IS NOT NULL AS exists`);
  if (!exists.rows[0]?.exists) return new Set();
  const rows = await mainPool.query<{ version: string }>(`SELECT version FROM migrations WHERE success = true`);
  return new Set(rows.rows.map((row) => (row.version.startsWith('V') ? row.version.slice(1) : row.version)));
}

/**
 * Применяет схему базы CoopID (coop_domain_db).
 *
 * Таблицы этой базы до 20.10.2026 создавали миграции данных, которые на узле
 * идут только с выпуском, — и узел после первой установки стоял без них. Теперь
 * схему применяет контроллер при старте и шаг схемы выкатки, как у основной базы.
 *
 * Перенос учёта: миграция, уже прошедшая на узле как миграция данных (версия в
 * {@link COOP_DOMAIN_LEGACY_VERSIONS} отмечена успешной), получает отметку в
 * учёте схемы без повторного выполнения. Остальные выполняются.
 *
 * @param coopPool — пул coop_domain_db.
 * @param mainPool — пул основной базы кооператива: в нём учёт миграций данных.
 */
export async function runCoopDomainSchemaMigrations(
  coopPool: Pool,
  mainPool: Pool,
  onApplied?: (name: string, index: number, total: number) => void
): Promise<string[]> {
  return runSchemaMigrations(coopPool, onApplied, {
    migrations: coopDomainDatabaseMigrations.map(named).sort((a, b) => a.timestamp - b.timestamp),
    lockKey: COOP_DOMAIN_SCHEMA_LOCK,
    adopt: async (pending) => {
      const legacy = await legacyAppliedVersions(mainPool);
      return new Set(pending.filter((name) => legacy.has(COOP_DOMAIN_LEGACY_VERSIONS[name])));
    },
  });
}
