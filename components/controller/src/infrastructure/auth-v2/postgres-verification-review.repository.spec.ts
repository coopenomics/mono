import { rowsOf } from './postgres-verification-review.repository';

/**
 * TypeORM отдаёт результат `query` по-разному в зависимости от вида запроса:
 * у UPDATE и DELETE это пара «строки и число задетых», у SELECT и INSERT —
 * сами строки. Журнал читает `RETURNING *` после UPDATE, и на первой же
 * попытке отозвать верификацию разбор пары как одной записи ронял мутацию —
 * причём уже после того, как цепь отзыв провела.
 */
describe('rowsOf', () => {
  const row = { id: 'rev-1' };

  it('разворачивает пару «строки и счётчик» от UPDATE', () => {
    expect(rowsOf([[row], 1])).toEqual([row]);
  });

  it('оставляет как есть плоский список строк от SELECT и INSERT', () => {
    expect(rowsOf([row])).toEqual([row]);
  });

  it('пустой ответ UPDATE читается как «строк нет», а не как одна пустая', () => {
    expect(rowsOf([[], 0])).toEqual([]);
  });

  it('ответ не массивом не роняет чтение', () => {
    expect(rowsOf(undefined)).toEqual([]);
    expect(rowsOf(null)).toEqual([]);
  });
});
