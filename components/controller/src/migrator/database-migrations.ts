// Реестр расширений заполняет состав миграций; без него миграции расширений
// не попали бы в ленту при запуске из CLI мигратора. Настройки контура —
// раньше реестра: расширения читают их уже при импорте.
import '~/config/platform-bootstrap';
import '~/extensions/extensions.registry';
import logger from '~/config/logger';
import { createMainPool } from '~/infrastructure/database/postgres/postgres-connection';
import { runSchemaMigrations } from '~/infrastructure/database/schema/schema-migrations';

/**
 * Применить непринятые миграции схемы (таблицы, колонки, индексы).
 *
 * Идут первыми, до миграций данных: те читают и правят таблицы, которые
 * создают эти. Каждая миграция — в своей транзакции: упавшая откатывается
 * целиком и не оставляет базу наполовину изменённой, а принятые до неё
 * остаются принятыми.
 *
 * @param database — база; по умолчанию база кооператива из конфига.
 * @returns Имена применённых миграций (пусто, если нечего применять).
 */
export async function runDatabaseMigrations(database?: string): Promise<string[]> {
  const pool = createMainPool(database);
  try {
    const applied = await runSchemaMigrations(pool, (name, index, total) =>
      logger.info(`Миграция схемы [${index}/${total}]: ${name}`)
    );
    if (!applied.length) logger.info('Миграции схемы: применять нечего');
    return applied;
  } finally {
    await pool.end();
  }
}
