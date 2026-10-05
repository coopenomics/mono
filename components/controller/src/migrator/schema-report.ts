// i18n-ignore-file: отчёт о схеме для журнала деплоя и оператора, до пайщика не доходит
// Реестр расширений (состав их миграций) подключает database-migrations.
import config from '~/config/config';
import { createMainPool } from '~/infrastructure/database/postgres/postgres-connection';
import { DATABASE_MIGRATIONS_TABLE, pendingSchemaMigrations } from '~/infrastructure/database/schema/schema-migrations';
import { runDatabaseMigrations } from './database-migrations';

export interface SchemaReport {
  database: string;
  /** Применённые миграции схемы — по учёту `schema_migrations`. */
  executed: string[];
  /** Миграции этой версии, которых в базе ещё нет. */
  pending: string[];
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

  const pool = createMainPool(database);
  try {
    const pending = await pendingSchemaMigrations(pool);
    const rows = await pool.query<{ name: string }>(`SELECT name FROM "${DATABASE_MIGRATIONS_TABLE}" ORDER BY id`);
    return { database, executed: rows.rows.map((row) => row.name), pending };
  } finally {
    await pool.end();
  }
}

/** Отчёт текстом — для журнала выкатки и вывода команды. */
export function formatSchemaReport(report: SchemaReport): string {
  const lines = [
    `База ${report.database}: применено миграций схемы ${report.executed.length}, ждут применения ${report.pending.length}`,
    ...report.pending.map((name) => `  ждёт: ${name}`),
  ];
  return lines.join('\n');
}
