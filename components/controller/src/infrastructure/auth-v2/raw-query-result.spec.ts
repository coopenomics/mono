import { affectedRows, rowsOf } from './raw-query-result';

/**
 * TypeORM на Postgres отдаёт из `query` для UPDATE/DELETE пару
 * `[строки, число затронутых]`. До 25.09.2026 хранилища CoopID считали
 * `rows.length` и всегда видели 2: повтор кода второго фактора принимался.
 */
describe('разбор ответа query', () => {
  it('UPDATE/DELETE: число затронутых — второй элемент пары, строки — первый', () => {
    expect(affectedRows([[], 0])).toBe(0);
    expect(affectedRows([[{ subject_id: 'u1' }], 1])).toBe(1);
    expect(rowsOf([[{ id: 1 }, { id: 2 }], 2])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('SELECT/INSERT: сами строки', () => {
    expect(affectedRows([{ id: 1 }])).toBe(1);
    expect(affectedRows([])).toBe(0);
    expect(rowsOf([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('не массив — ноль строк', () => {
    expect(affectedRows(undefined)).toBe(0);
    expect(rowsOf(null)).toEqual([]);
  });
});
