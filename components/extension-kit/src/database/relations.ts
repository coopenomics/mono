import type { TableStore, Where } from './table-store';
import { oneOf } from './table-store';

/**
 * Подгружает к записям связанную запись другой таблицы и кладёт её в поле
 * `property`. `keys` — соответствие «поле связанной записи → поле своей»;
 * связь по нескольким полям ищется одним запросом и сводится в памяти. Запись
 * без пары остаётся без поля.
 */
export async function attachOne<TRecord extends object, TRelated extends object>(
  records: TRecord[],
  related: TableStore<TRelated>,
  property: string,
  keys: Record<string, string>
): Promise<void> {
  if (records.length === 0) return;
  const pairs = Object.entries(keys);
  const read = (record: object, field: string): unknown => (record as Record<string, unknown>)[field];
  const where: Record<string, unknown> = {};
  for (const [relatedField, ownField] of pairs) {
    const values = [...new Set(records.map((record) => read(record, ownField)).filter((value) => value !== null && value !== undefined))];
    if (values.length === 0) return;
    where[relatedField] = oneOf(values);
  }
  const found = await related.find(where as Where<TRelated>);
  const signature = (record: object, side: 0 | 1): string => pairs.map((pair) => String(read(record, pair[side]))).join('\u0000');
  const index = new Map<string, TRelated>();
  for (const candidate of found) {
    const key = signature(candidate, 0);
    if (!index.has(key)) index.set(key, candidate);
  }
  for (const record of records) {
    const match = index.get(signature(record, 1));
    if (match) (record as Record<string, unknown>)[property] = match;
  }
}
