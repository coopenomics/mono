// Реестр расширений заполняет состав сущностей и их миграций; без него
// миграции расширений не попали бы в ленту при запуске из CLI мигратора.
// Настройки контура — раньше реестра: расширения читают их уже при импорте.
import '~/config/platform-bootstrap';
import '~/extensions/extensions.registry';
import { DataSource, type Logger } from 'typeorm';
import logger from '~/config/logger';
import { mainDataSourceOptions } from '~/infrastructure/database/typeorm/data-source.options';

/**
 * Прогресс наката: TypeORM сообщает о каждой применённой миграции через
 * `logSchemaBuild`, и по нему видно, где накат сейчас, а не только итог в конце.
 * Остальные сообщения (запросы и прочее) здесь не нужны.
 */
class MigrationProgressLogger implements Logger {
  private total = 0;
  private done = 0;

  logSchemaBuild(message: string): void {
    const pending = message.match(/^(\d+) migrations are new migrations/);
    if (pending) {
      this.total = Number(pending[1]);
      logger.info(`Миграции схемы: к применению ${this.total}`);
      return;
    }
    const executed = message.match(/^Migration (\S+) has been .*executed successfully/);
    if (executed) logger.info(`Миграция схемы [${++this.done}/${this.total}]: ${executed[1]}`);
  }

  logMigration(message: string): void {
    logger.warn(`Миграции схемы: ${message}`);
  }

  logQuery(): void {}
  logQueryError(): void {}
  logQuerySlow(): void {}
  log(): void {}
}

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
  const dataSource = new DataSource({ ...mainDataSourceOptions(database), logger: new MigrationProgressLogger() });
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    if (!applied.length) logger.info('Миграции схемы: применять нечего');
    return applied.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}
