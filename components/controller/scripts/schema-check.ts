/**
 * Проверка миграций схемы (C28-79, C28-81).
 *
 *   pnpm schema:check                    — гейт: на пустой базе применяются все
 *                                          миграции, повторный прогон не
 *                                          применяет ни одной. Иначе код 1.
 *   pnpm schema:check --database <база>  — только чтение: какие миграции в
 *                                          существующей базе ещё не применены
 *                                          (тот же отчёт, что --schema-report
 *                                          собранного контроллера на узле).
 *
 * Гейт ловит миграцию, которая не применяется на чистой базе, и сломанный учёт
 * применённых миграций. Что типы запросов соответствуют схеме из миграций,
 * проверяет `pnpm schema:types --verify`.
 */
import './schema-tools';
import { withScratchDatabase } from './schema-tools';
import { runDatabaseMigrations } from '~/migrator/database-migrations';
import { formatSchemaReport, reportSchema } from '~/migrator/schema-report';

async function checkFresh(): Promise<number> {
  return withScratchDatabase('schema_check', async (database) => {
    const applied = await runDatabaseMigrations(database);
    process.stdout.write(`Миграций применено на пустой базе: ${applied.length}\n`);
    // Повторный прогон обязан ничего не делать — миграции идемпотентны по учёту.
    const again = await runDatabaseMigrations(database);
    if (again.length) {
      process.stdout.write(`Повторный прогон применил ещё ${again.length} — учёт миграций сломан\n`);
      return 1;
    }
    process.stdout.write('Миграции схемы применяются на пустой базе, повторный прогон чист\n');
    return 0;
  });
}

async function checkDatabase(database: string): Promise<number> {
  process.stdout.write(`${formatSchemaReport(await reportSchema({ database }))}\n`);
  return 0;
}

async function main() {
  const index = process.argv.indexOf('--database');
  const code = index > -1 ? await checkDatabase(process.argv[index + 1]) : await checkFresh();
  process.exit(code);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
