/**
 * Проверка «сущности = миграции» (C28-79).
 *
 *   pnpm schema:check                    — гейт: пустая база, все миграции,
 *                                          затем TypeORM не должен видеть ни одного
 *                                          отличия от сущностей. Иначе код 1.
 *   pnpm schema:check --database <база>  — только чтение: чем существующая база
 *                                          отличается от сущностей и какие
 *                                          миграции в ней ещё не применены.
 *
 * Гейт ловит правку сущности без миграции: колонка добавлена в класс, а в
 * истории миграций её нет — значит, на узлах кооперативов её не будет.
 */
import { pendingSchemaSql, withDataSource, withScratchDatabase } from './schema-tools';

function report(title: string, statements: string[]): void {
  process.stdout.write(`${title}: ${statements.length}\n`);
  for (const sql of statements) process.stdout.write(`  ${sql}\n`);
}

async function checkFresh(): Promise<number> {
  return withScratchDatabase('schema_check', (database) =>
    withDataSource(database, async (dataSource) => {
      const applied = await dataSource.runMigrations({ transaction: 'each' });
      process.stdout.write(`Миграций применено на пустой базе: ${applied.length}\n`);
      // Повторный прогон обязан ничего не делать — миграции идемпотентны по учёту.
      const again = await dataSource.runMigrations({ transaction: 'each' });
      if (again.length) {
        process.stdout.write(`Повторный прогон применил ещё ${again.length} — учёт миграций сломан\n`);
        return 1;
      }
      const { up } = await pendingSchemaSql(dataSource);
      if (!up.length) {
        process.stdout.write('Схема из миграций совпадает с сущностями\n');
        return 0;
      }
      report('Сущности расходятся с миграциями — нужна миграция (pnpm schema:generate)', up);
      return 1;
    })
  );
}

async function checkDatabase(database: string): Promise<number> {
  return withDataSource(database, async (dataSource) => {
    const pending = await dataSource.showMigrations();
    const executed: Array<{ name: string }> = (await dataSource
      .query(`SELECT name FROM "schema_migrations" ORDER BY id`)
      .catch(() => [])) as Array<{ name: string }>;
    process.stdout.write(`База ${database}: применено миграций схемы ${executed.length}, ждут применения: ${pending ? 'да' : 'нет'}\n`);
    const { up } = await pendingSchemaSql(dataSource);
    report('Отличия базы от сущностей (SQL, которым TypeORM привёл бы её к коду)', up);
    return 0;
  });
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
