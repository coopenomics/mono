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
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import config from '~/config/config';
import { CONTROLLER_ROOT, withDataSource, withScratchDatabase } from './schema-tools';

const OUT_FILE = 'src/infrastructure/database/kysely/database.types.ts';

async function main() {
  const verify = process.argv.includes('--verify');
  const code = await withScratchDatabase('schema_types', async (database) => {
    await withDataSource(database, (dataSource) => dataSource.runMigrations({ transaction: 'each' }));
    const { host, port, username, password } = config.postgres;
    const url = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    const result = spawnSync(
      path.join(CONTROLLER_ROOT, 'node_modules/.bin/kysely-codegen'),
      ['--dialect', 'postgres', '--out-file', OUT_FILE, ...(verify ? ['--verify'] : [])],
      { cwd: CONTROLLER_ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' }
    );
    return result.status ?? 1;
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
