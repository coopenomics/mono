import { rpc } from '../eos';

/**
 * Полный обход таблицы блокчейна с пагинацией.
 *
 * Используется миграциями для чтения soviet::agreements3, soviet::progwallets,
 * soviet::participants и аналогичных таблиц с произвольным числом записей.
 */
export async function fetchAllRows<T = any>(opts: {
  code: string;
  scope: string;
  table: string;
  index_position?: number;
  key_type?: string;
  limit?: number;
}): Promise<T[]> {
  const result: T[] = [];
  let lower_bound: string | undefined;
  const limit = opts.limit ?? 200;

  while (true) {
    const rows = await rpc.get_table_rows({
      json: true,
      code: opts.code,
      scope: opts.scope,
      table: opts.table,
      index_position: opts.index_position,
      key_type: opts.key_type,
      limit,
      lower_bound,
    });

    for (const row of rows.rows as T[]) {
      result.push(row);
    }

    if (!rows.more) break;
    lower_bound = rows.next_key;
  }

  return result;
}
