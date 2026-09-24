// Реестр расширений заполняет состав сущностей и их миграций; без него
// миграции расширений не попали бы в ленту при запуске из CLI мигратора.
// Настройки контура — раньше реестра: расширения читают их уже при импорте.
import '~/config/platform-bootstrap';
import '~/extensions/extensions.registry';
import { DataSource } from 'typeorm';
import logger from '~/config/logger';
import { mainDataSourceOptions } from '~/infrastructure/database/typeorm/data-source.options';

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
  const dataSource = new DataSource(mainDataSourceOptions(database));
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    for (const migration of applied) logger.info(`Миграция схемы применена: ${migration.name}`);
    if (!applied.length) logger.info('Миграции схемы: применять нечего');
    return applied.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}
