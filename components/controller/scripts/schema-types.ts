/**
 * Типы таблиц для Kysely — из миграций, а не из сущностей (C28-81).
 *
 *   pnpm schema:types           — пустая база, все миграции, затем типы таблиц
 *                                 пишутся в src/infrastructure/database/kysely/database.types.ts.
 *   pnpm schema:types --verify  — гейт: файл типов обязан совпадать с тем, что
 *                                 дают миграции. Иначе код 1.
 *
 * Гейт ловит миграцию без пересборки типов: запросы Kysely проверялись бы по
 * устаревшей схеме.
 *
 * Расширение не импортирует ядро, поэтому типы своих таблиц держит у себя:
 * перечень таблиц — `src/extensions/<имя>/<имя>.tables.ts` (экспорт по
 * умолчанию — массив имён), типы пишутся рядом, в
 * `infrastructure/database/<имя>.database.types.ts`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import config from '~/config/config';
import fs from 'node:fs';
import { CONTROLLER_ROOT, EXTENSIONS_DIR, withDataSource, withScratchDatabase } from './schema-tools';

const OUT_FILE = 'src/infrastructure/database/kysely/database.types.ts';

/** Файлы типов: общий для ядра и по одному на расширение, объявившее свои таблицы. */
function targets(): Array<{ outFile: string; tables?: readonly string[] }> {
  const result: Array<{ outFile: string; tables?: readonly string[] }> = [{ outFile: OUT_FILE }];
  for (const name of fs.readdirSync(EXTENSIONS_DIR).sort()) {
    const declaration = path.join(EXTENSIONS_DIR, name, `${name}.tables.ts`);
    if (!fs.existsSync(declaration)) continue;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tables = (require(declaration) as { default: readonly string[] }).default;
    result.push({ outFile: `src/extensions/${name}/infrastructure/database/${name}.database.types.ts`, tables });
  }
  return result;
}

function generate(url: string, target: { outFile: string; tables?: readonly string[] }, verify: boolean): number {
  const include = target.tables ? ['--include-pattern', `public.{${target.tables.join(',')},}`] : [];
  const result = spawnSync(
    path.join(CONTROLLER_ROOT, 'node_modules/.bin/kysely-codegen'),
    ['--dialect', 'postgres', '--out-file', target.outFile, ...include, ...(verify ? ['--verify'] : [])],
    { cwd: CONTROLLER_ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' }
  );
  return result.status ?? 1;
}

async function main() {
  const verify = process.argv.includes('--verify');
  const code = await withScratchDatabase('schema_types', async (database) => {
    await withDataSource(database, (dataSource) => dataSource.runMigrations({ transaction: 'each' }));
    const { host, port, username, password } = config.postgres;
    const url = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    return targets().reduce((status, target) => status || generate(url, target, verify), 0);
  });
  if (code && verify) {
    process.stdout.write('Типы Kysely устарели: после миграции нужен pnpm schema:types\n');
  }
  process.exit(code);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
