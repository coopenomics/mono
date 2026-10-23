import { CompiledQuery, type Kysely } from 'kysely';

/**
 * Запросы к основной базе кооператива через Kysely (C28-81).
 *
 * Ядро отдаёт по этому токену один экземпляр на всё приложение; расширение
 * внедряет его и типизирует своими таблицами — `Kysely<МоиТаблицы>`. Типы
 * таблиц расширения лежат в нём самом и собираются из его миграций
 * (`pnpm schema:types`).
 *
 * Токен — `Symbol.for`: расширение и ядро берут его каждый из своей копии
 * пакета и обязаны совпасть по глобальному реестру символов.
 */
export const KYSELY = Symbol.for('Controller.Database.Kysely');

/**
 * Сортировка списка по полю, названному клиентом.
 *
 * Имя колонки в запрос попадает только из перечня, заданного хранилищем: всё
 * остальное — опечатка, чужое поле или попытка подставить SQL — заменяется
 * сортировкой по умолчанию.
 */
export function sortColumn<const TColumn extends string>(
  allowed: readonly TColumn[],
  requested: string | undefined | null,
  fallback: TColumn
): TColumn {
  return allowed.includes(requested as TColumn) ? (requested as TColumn) : fallback;
}

/** Направление сортировки — только возрастание или убывание. */
export function sortDirection(requested: unknown, fallback: 'asc' | 'desc' = 'desc'): 'asc' | 'desc' {
  const value = typeof requested === 'string' ? requested.toUpperCase() : '';
  if (value === 'ASC') return 'asc';
  if (value === 'DESC') return 'desc';
  return fallback;
}

/**
 * Готовый запрос SQL с нумерованными параметрами (`$1`, `$2`, …) — для сложных
 * выборок, которые яснее читать текстом: оконные функции, агрегаты с порядком,
 * соединение таблицы с собой. Значения передаются только параметрами; в текст
 * запроса данные вызывающего не подставляются.
 */
export async function rawQuery<TRow = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: Kysely<any>,
  text: string,
  parameters: readonly unknown[] = []
): Promise<TRow[]> {
  const result = await db.executeQuery<TRow>(CompiledQuery.raw(text, [...parameters]));
  return result.rows;
}

const toCamel = (key: string): string => key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
const toSnake = (key: string): string => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/**
 * Строка базы (колонки `snake_case`) в объект с полями `camelCase`. Переводятся
 * только имена верхнего уровня: вложенное содержимое json-колонок остаётся как
 * есть.
 */
export function camelRow<TResult>(row: Record<string, unknown>): TResult {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toCamel(key), value])) as TResult;
}

/**
 * Объект с полями `camelCase` в значения колонок `snake_case`. Незаданные поля
 * (`undefined`) пропускаются: при правке это значит «не трогать».
 */
export function snakeRow(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [toSnake(key), value])
  );
}

/**
 * Число затронутых записью строк. Правка и удаление отдают счётчик, но для
 * таблиц ленты изменений слой базы дописывает `RETURNING` — и вместо счётчика
 * приходят сами строки. Считать через этот помощник и `execute()`:
 * `executeTakeFirst()` на такой таблице вернёт строку либо пустоту.
 */
export function affectedCount(results: readonly unknown[]): number {
  const [first] = results;
  const summary = first as { numDeletedRows?: bigint; numUpdatedRows?: bigint } | undefined;
  const counted = summary?.numDeletedRows ?? summary?.numUpdatedRows;
  if (results.length === 1 && typeof counted === 'bigint') return Number(counted);
  return results.length;
}

/**
 * Основная база узла для готовых запросов конфигурационных миграций
 * расширений. Ответ — в прежнем виде: у выборки и вставки строки, у правки и
 * удаления — пара «строки и число затронутых».
 */
export interface MainDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(sql: string, parameters?: unknown[]): Promise<any>;
}

export const MAIN_DATABASE = Symbol.for('Controller.Database.Main');
