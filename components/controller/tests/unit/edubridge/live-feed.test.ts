import fs from 'node:fs';
import path from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { EDU_LIVE_TABLES } from '~/extensions/edubridge/application/services/edubridge-live-feed.service';
import { edubridgeEntities } from '~/extensions/edubridge/edubridge.entities';

/**
 * Лента изменений образования держится на именах: сервер объявляет таблицы по
 * имени из `@Entity`, подписчик базы узнаёт запись по имени таблицы, стол
 * слушает те же имена. Опечатка в любом из трёх мест не падает, а молча
 * выключает живое обновление экрана — поэтому имена сверяются здесь.
 */
describe('лента изменений образования', () => {
  const storage = getMetadataArgsStorage();
  const tableOf = (target: unknown) => storage.tables.find((t) => t.target === target)?.name;
  const entityTables = new Map(edubridgeEntities.map((entity) => [tableOf(entity), entity]));

  it('каждая объявленная таблица — таблица сущности образования', () => {
    for (const declared of EDU_LIVE_TABLES) {
      expect(entityTables.has(declared.table)).toBe(true);
    }
  });

  it('поле владельца личной таблицы — колонка её сущности', () => {
    for (const declared of EDU_LIVE_TABLES.filter((t) => t.owner_field)) {
      const entity = entityTables.get(declared.table);
      const columns = storage.columns.filter((c) => c.target === entity).map((c) => c.options.name ?? c.propertyName);
      expect(columns).toContain(declared.owner_field);
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
