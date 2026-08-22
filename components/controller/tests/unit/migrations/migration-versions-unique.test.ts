import fs from 'fs';
import path from 'path';

/**
 * Гейт против коллизии номеров миграций.
 *
 * `MigrationManager` держит применённые миграции в Map по НОМЕРУ ВЕРСИИ, а имя
 * файла в этот ключ не входит. Поэтому два файла с одним номером на чистой базе
 * оба отработают (записи ещё нет), а на живом узле второй молча пропустится как
 * «уже применённый» — и следующие миграции упадут на схеме, которой никто не
 * создал.
 *
 * Кейс 2026-08-22: `V2.4.0__coopid_coop_domain_db_init` совпала номером с
 * `V2.4.0__backfill_parser_history_from_mongo`, coop_domain_db осталась пустой,
 * деплой voskhod встал на V2.4.1 с `relation "vaults" does not exist`.
 */
describe('файлы миграций', () => {
  const migrationsDir = path.resolve(__dirname, '../../../migrations');

  const versions = fs
    .readdirSync(migrationsDir)
    .map((file) => ({ file, match: /^V(\d+(?:\.\d+)*)__.+\.[tj]s$/.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => ({ file, version: match[1] }));

  it('каталог миграций не пуст (иначе тест зелёный впустую)', () => {
    expect(versions.length).toBeGreaterThan(10);
  });

  it('номер версии уникален', () => {
    const byVersion = new Map<string, string[]>();
    for (const { file, version } of versions) {
      byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
    }

    const collisions = [...byVersion.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([version, files]) => `${version}: ${files.join(', ')}`);

    expect(collisions).toEqual([]);
  });
});
