// Реестр расширений (состав сущностей и их миграций) подключает database-migrations.
import { DataSource } from 'typeorm';
import config from '~/config/config';
import {
  DATABASE_MIGRATIONS_TABLE,
  mainDataSourceOptions,
} from '~/infrastructure/database/typeorm/data-source.options';
import { runDatabaseMigrations } from './database-migrations';

export interface SchemaReport {
  database: string;
  /** Применённые миграции схемы — по учёту `schema_migrations`. */
  executed: string[];
  /** Миграции этой версии, которых в базе ещё нет. */
  pending: string[];
  /** SQL, которым TypeORM привёл бы базу к сущностям этой версии. */
  drift: string[];
}

/**
 * Отчёт о схеме базы относительно этой версии контроллера (C28-79).
 *
 * Только читает. С `apply` сначала применяет миграции — это разрешено лишь для
 * копии: сверка перед релизом накатывает новую версию на копию базы узла и
 * смотрит, что останется, а боевую базу не трогает.
 *
 * @param options.database — база; по умолчанию база кооператива из конфига.
 * @param options.apply — применить миграции перед отчётом (только не к боевой базе).
 * @throws Error Если `apply` запрошен для базы кооператива из конфига.
 */
export async function reportSchema(options: { database?: string; apply?: boolean } = {}): Promise<SchemaReport> {
  const database = options.database ?? config.postgres.database;
  if (options.apply) {
    if (database === config.postgres.database) {
      throw new Error(`Отчёт с --apply применяет миграции и разрешён только для копии, а не для базы ${database}`);
    }
    await runDatabaseMigrations(database);
  }

  const dataSource = new DataSource(mainDataSourceOptions(database));
  await dataSource.initialize();
  try {
    const rows: Array<{ name: string }> = await dataSource
      .query(`SELECT name FROM "${DATABASE_MIGRATIONS_TABLE}" ORDER BY id`)
      .catch(() => []);
    const executed = rows.map((row) => row.name);
    const pending = dataSource.migrations
      .map((migration) => migration.name ?? migration.constructor.name)
      .filter((name) => !executed.includes(name));
    const log = await dataSource.driver.createSchemaBuilder().log();
    return { database, executed, pending, drift: log.upQueries.map((query) => query.query) };
  } finally {
    await dataSource.destroy();
  }
}

/** Отчёт текстом — для журнала выкатки и вывода команды. */
export function formatSchemaReport(report: SchemaReport): string {
  const lines = [
    `База ${report.database}: применено миграций схемы ${report.executed.length}, ждут применения ${report.pending.length}`,
    ...report.pending.map((name) => `  ждёт: ${name}`),
    `Отличия базы от сущностей этой версии: ${report.drift.length}`,
    ...report.drift.map((sql) => `  ${sql}`),
  ];
  return lines.join('\n');
}
