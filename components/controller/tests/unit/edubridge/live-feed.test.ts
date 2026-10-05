import fs from 'node:fs';
import path from 'node:path';
import { EDU_LIVE_TABLES } from '~/extensions/edubridge/application/services/edubridge-live-feed.service';

const EXTENSION = path.join(__dirname, '../../../src/extensions/edubridge');

/**
 * Лента изменений образования держится на именах: сервер объявляет таблицы по
 * имени, под которым их знает шлюз таблицы, подписчик базы узнаёт запись по
 * имени таблицы, стол слушает те же имена. Опечатка в любом из трёх мест не
 * падает, а молча выключает живое обновление экрана — поэтому имена сверяются
 * здесь.
 */
describe('лента изменений образования', () => {
  const stores = fs.readFileSync(path.join(EXTENSION, 'infrastructure/database/edubridge-stores.ts'), 'utf8');
  const storeTables = new Set([...stores.matchAll(/table: '(edubridge_[a-z_]+)'/g)].map((m) => m[1]));
  const migrationsDir = path.join(EXTENSION, 'migrations/database');
  const migrations = fs
    .readdirSync(migrationsDir)
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n');
  /** Инструкции миграций, которые заводят таблицу или добавляют ей колонку. */
  const ddlOf = (table: string) =>
    migrations.split('\n').filter((line) => new RegExp(`(CREATE TABLE( IF NOT EXISTS)?|ALTER TABLE) \\\\"${table}\\\\"`).test(line));

  it('каждая объявленная таблица — таблица шлюза образования', () => {
    expect(storeTables.size).toBeGreaterThan(0);
    for (const declared of EDU_LIVE_TABLES) {
      expect(storeTables.has(declared.table)).toBe(true);
    }
  });

  it('поле владельца личной таблицы — колонка этой таблицы', () => {
    for (const declared of EDU_LIVE_TABLES.filter((t) => t.owner_field)) {
      const ddl = ddlOf(declared.table).join('\n');
      expect(ddl).toContain(`\\"${declared.owner_field}\\"`);
    }
  });

  it('стол слушает только то, что сервер объявил', () => {
    const live = fs.readFileSync(
      path.join(__dirname, '../../../../desktop/extensions/edubridge/shared/lib/live.ts'),
      'utf8'
    );
    const listened = [...live.matchAll(/table\('(edubridge_[a-z_]+)'\)/g)].map((m) => m[1]);
    const declared = new Set(EDU_LIVE_TABLES.map((t) => t.table));
    expect(listened.length).toBeGreaterThan(0);
    expect(listened.filter((name) => !declared.has(name))).toEqual([]);
  });
});
