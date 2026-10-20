// i18n-ignore-file: имя записи учёта миграций и сообщения журнала для оператора, до пайщика не доходят
import type { Pool } from 'pg';
import config from '~/config/config';
import logger from '~/config/logger';
import { createMainPool } from '~/infrastructure/database/postgres/postgres-connection';
import { migrateData } from './migrate';

/** Учёт миграций данных (мигратор `migrations/`) в основной базе кооператива. */
const DATA_MIGRATIONS_TABLE = 'migrations';

/**
 * Отметка первого старта в учёте миграций данных. Версия сортируется раньше
 * любой настоящей (`2.x`, `ГГГГММДДччмм`): «откатить последнюю» её не берёт,
 * файла под ней нет, и мигратор её не исполняет.
 */
export const FIRST_START_MARK = '0-first-start';

/** Пул основной базы: переданный либо свой на время вызова. */
async function withPool<T>(pool: Pool | undefined, work: (db: Pool) => Promise<T>): Promise<T> {
  const own = pool ? null : createMainPool();
  try {
    return await work(pool ?? (own as Pool));
  } finally {
    await own?.end();
  }
}

/**
 * Узлу нужны миграции первого старта: учёта миграций данных нет, он пуст либо
 * первый старт начался и не закончился (отметка без успеха).
 *
 * Последнее условие — защита от молчаливой поломки: первый старт, упавший
 * посреди миграций, оставляет в учёте записи, и без отметки следующий старт
 * принял бы узел за живой и оставил его без остальных миграций.
 */
export async function nodeNeedsFirstStartMigrations(pool?: Pool): Promise<boolean> {
  return withPool(pool, async (db) => {
    const table = await db.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [DATA_MIGRATIONS_TABLE]);
    if (!table.rows[0]?.exists) return true;
    const rows = await db.query<{ version: string; success: boolean }>(`SELECT version, success FROM "${DATA_MIGRATIONS_TABLE}"`);
    const mark = rows.rows.find((row) => row.version === FIRST_START_MARK);
    if (mark) return !mark.success;
    return rows.rows.length === 0;
  });
}

/** Поставить отметку первого старта: начат (success=false) либо завершён (true). */
export async function markFirstStart(success: boolean, pool?: Pool): Promise<void> {
  await withPool(pool, async (db) => {
    const table = await db.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [DATA_MIGRATIONS_TABLE]);
    // Учёт заводит сам мигратор; до него отметке «начат» негде жить. Её роль
    // тогда исполняет пустой учёт — он тоже означает «узлу нужны миграции».
    if (!table.rows[0]?.exists) return;
    const updated = await db.query(
      `UPDATE "${DATA_MIGRATIONS_TABLE}" SET success = $2, "executedAt" = now() WHERE version = $1`,
      [FIRST_START_MARK, success]
    );
    if (updated.rowCount) return;
    await db.query(
      `INSERT INTO "${DATA_MIGRATIONS_TABLE}" (version, name, "executedAt", success, logs) VALUES ($1, $2, now(), $3, '')`,
      [FIRST_START_MARK, 'Миграции первого старта узла', success]
    );
  });
}

/**
 * Миграции при старте контроллера, до приёма запросов.
 *
 * - Стенд (`AUTO_MIGRATE`): база создаётся с нуля каждый ребут — прогон всегда.
 * - Новый узел: выпуска, который провёл бы миграции, у него ещё не было — узел
 *   проводит их сам, один раз (тестнет, 20.10.2026: узел без миграций данных
 *   вставал без реестра шаблонов документов, бланк не собирался).
 * - Живой узел: ничего — миграции раскатывает выпуск; самовольный прогон при
 *   рестарте боевого узла недопустим.
 *
 * Падение фатально: поднявшись на неполной схеме, контроллер ломается не сразу
 * и по частям. Отметка первого старта остаётся незавершённой, и следующий
 * старт повторит миграции.
 */
export async function runStartupMigrations(): Promise<void> {
  const firstStart = !config.auto_migrate && (await nodeNeedsFirstStartMigrations());
  if (!config.auto_migrate && !firstStart) return;
  logger.info(
    firstStart
      ? 'Новый узел: миграции ещё не проводились — проводим все перед приёмом запросов'
      : 'AUTO_MIGRATE включён — прогоняем непринятые миграции перед приёмом запросов'
  );
  try {
    if (firstStart) await markFirstStart(false);
    await migrateData();
    if (firstStart) await markFirstStart(true);
  } catch (error) {
    logger.error('Миграции не прошли — не поднимаемся на неполной схеме', error);
    process.exit(1);
  }
}
