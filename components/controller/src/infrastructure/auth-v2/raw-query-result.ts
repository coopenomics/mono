/**
 * Разбор ответа `DataSource.query` на Postgres.
 *
 * TypeORM отдаёт для SELECT и INSERT сами строки, а для UPDATE и DELETE — пару
 * `[строки, число затронутых]`. Код, который считает `rows.length` у UPDATE или
 * DELETE, всегда видит 2: так повтор кода второго фактора принимался, отзыв
 * набора прав отвечал «отозван» при отсутствии записи, а очистка истёкших
 * правил доступа сообщала неверное число (до 25.09.2026).
 */

/** Строки ответа — и для SELECT/INSERT, и для UPDATE/DELETE … RETURNING. */
export function rowsOf<T>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  const [first] = raw;
  return Array.isArray(first) ? (first as T[]) : (raw as T[]);
}

/** Сколько строк затронуто. */
export function affectedRows(raw: unknown): number {
  if (Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[1];
  }
  return rowsOf(raw).length;
}
