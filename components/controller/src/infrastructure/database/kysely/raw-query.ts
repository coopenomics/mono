import { CompiledQuery } from 'kysely';
import type { Database } from './kysely.tokens';

/**
 * Готовый запрос SQL с нумерованными параметрами (`$1`, `$2`, …) — для сложных
 * выборок, которые яснее читать текстом: оконные функции, агрегаты с порядком,
 * соединение таблицы с собой. Значения передаются только параметрами; в текст
 * запроса данные вызывающего не подставляются.
 */
export async function rawQuery<TRow = Record<string, unknown>>(
  db: Database,
  text: string,
  parameters: readonly unknown[] = []
): Promise<TRow[]> {
  const result = await db.executeQuery<TRow>(CompiledQuery.raw(text, [...parameters]));
  return result.rows;
}
