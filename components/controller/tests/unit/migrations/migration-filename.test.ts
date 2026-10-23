/**
 * Имя файла миграции данных — ключ учёта и порядок (C28-79).
 *
 * Прежние `V<версия>__` заморожены: они уже применены на узлах под своими
 * версиями. Новые именуются меткой времени и идут после всех прежних.
 */
import {
  compareMigrationFilenames,
  isMigrationFile,
  migrationTimestamp,
  parseMigrationFilename,
} from '~/migrator/migration-filename';

describe('имя файла миграции данных', () => {
  it('прежний формат: ключ — версия', () => {
    expect(parseMigrationFilename('V2.5.7__backfill_member_since.ts')).toEqual({
      version: '2.5.7',
      description: 'backfill member since',
      legacy: true,
      order: [2, 5, 7],
    });
  });

  it('текущий формат: ключ — метка времени', () => {
    expect(parseMigrationFilename('202609232115__backfill_member_since.ts')).toEqual({
      version: '202609232115',
      description: 'backfill member since',
      legacy: false,
      order: [202609232115],
    });
  });

  it('метка, не являющаяся датой, отклоняется', () => {
    expect(() => parseMigrationFilename('202613012115__x.ts')).toThrow('не является датой');
    expect(() => parseMigrationFilename('202602302115__x.ts')).toThrow('не является датой');
  });

  it('имя без формата отклоняется', () => {
    expect(() => parseMigrationFilename('backfill.ts')).toThrow('Неверное имя файла миграции');
  });

  it('прежние идут раньше текущих, внутри — по числам, а не по строке', () => {
    const names = ['202609232115__b.ts', 'V2.10.0__c.ts', '202601010000__a.ts', 'V2.9.0__d.ts'];
    const sorted = names
      .map((name) => ({ name, parsed: parseMigrationFilename(name) }))
      .sort((a, b) => compareMigrationFilenames(a.parsed, b.parsed))
      .map(({ name }) => name);
    expect(sorted).toEqual(['V2.9.0__d.ts', 'V2.10.0__c.ts', '202601010000__a.ts', '202609232115__b.ts']);
  });

  it('файлами миграций считаются оба формата, объявления типов и прочее — нет', () => {
    expect(isMigrationFile('V1.0.0__initial.ts')).toBe(true);
    expect(isMigrationFile('202609232115__x.js')).toBe(true);
    expect(isMigrationFile('202609232115__x.d.ts')).toBe(false);
    expect(isMigrationFile('README.md')).toBe(false);
  });

  it('метка для нового файла — UTC до минуты, и она же разбирается обратно', () => {
    const stamp = migrationTimestamp(new Date(Date.UTC(2026, 8, 23, 21, 15, 42)));
    expect(stamp).toBe('202609232115');
    expect(parseMigrationFilename(`${stamp}__x.ts`).version).toBe(stamp);
  });
});
