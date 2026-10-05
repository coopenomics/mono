import type { Kysely } from 'kysely';
import { rawQuery } from './kysely';

type Params = Record<string, unknown>;

interface BuilderHost<TRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kysely: Kysely<any>;
  table: string;
  primaryKey: string[];
  records(rows: Array<Record<string, unknown>>): TRecord[];
}

/**
 * Сборщик выборки из готовых фрагментов SQL с именованными параметрами — для
 * запросов, которые яснее читать текстом: соединения таблиц, подзапросы,
 * агрегаты. Значения передаются только параметрами (`:имя`, перечень —
 * `:...имя`); в текст запроса данные вызывающего не подставляются. Исполняет
 * запрос Kysely.
 *
 * ```ts
 * store.sqlBuilder('p').where('p.coopname = :coopname', { coopname }).orderBy('p.created_at', 'DESC').getMany();
 * ```
 */
export class SqlBuilder<TRecord extends object> {
  private selections: string[] = [];
  private distinctRows = false;
  private joins: string[] = [];
  private conditions: string[] = [];
  private groups: string[] = [];
  private orders: string[] = [];
  private rowLimit?: number;
  private rowOffset?: number;
  private params: Params = {};

  constructor(private readonly host: BuilderHost<TRecord>, private readonly alias: string) {}

  /** Выбираемое выражение; псевдоним таблицы целиком — все её колонки (так и по умолчанию). */
  select(expression: string | string[], as?: string): this {
    this.selections = [];
    return this.addSelect(expression, as);
  }

  /**
   * Колонка без своего имени (`te.issue_hash`) в сырой выборке называется
   * `te_issue_hash` — по псевдониму таблицы и имени колонки.
   */
  addSelect(expression: string | string[], as?: string): this {
    for (const item of Array.isArray(expression) ? expression : [expression]) {
      if (item === this.alias) continue;
      const column = /^(\w+)\.(\w+)$/.exec(item);
      const name = as ?? (column ? `${column[1]}_${column[2]}` : undefined);
      this.selections.push(name ? `${item} AS "${name}"` : item);
    }
    return this;
  }

  distinct(enabled = true): this {
    this.distinctRows = enabled;
    return this;
  }

  innerJoin(table: string, alias: string, on: string, params: Params = {}): this {
    return this.join('INNER', table, alias, on, params);
  }

  leftJoin(table: string, alias: string, on: string, params: Params = {}): this {
    return this.join('LEFT', table, alias, on, params);
  }

  where(condition: string, params: Params = {}): this {
    this.conditions = [];
    return this.andWhere(condition, params);
  }

  andWhere(condition: string, params: Params = {}): this {
    this.conditions.push(`(${condition})`);
    Object.assign(this.params, params);
    return this;
  }

  groupBy(expression: string): this {
    this.groups = [expression];
    return this;
  }

  addGroupBy(expression: string): this {
    this.groups.push(expression);
    return this;
  }

  orderBy(expression: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orders = [];
    return this.addOrderBy(expression, direction);
  }

  addOrderBy(expression: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orders.push(`${expression} ${direction === 'DESC' ? 'DESC' : 'ASC'}`);
    return this;
  }

  limit(count?: number): this {
    this.rowLimit = count;
    return this;
  }

  offset(count?: number): this {
    this.rowOffset = count;
    return this;
  }

  /** Записи таблицы сборщика. */
  async getMany(): Promise<TRecord[]> {
    const { text, values } = this.compile(`${this.distinctRows ? 'DISTINCT ' : ''}${this.alias}.*`, true);
    return this.host.records(await rawQuery(this.host.kysely, text, values));
  }

  async getOne(): Promise<TRecord | null> {
    const saved = this.rowLimit;
    this.rowLimit = 1;
    const [record] = await this.getMany();
    this.rowLimit = saved;
    return record ?? null;
  }

  /** Число записей таблицы сборщика под условиями; соединения запись не размножают. */
  async getCount(): Promise<number> {
    const key = this.host.primaryKey.map((column) => `${this.alias}."${column}"`).join(', ');
    const { text, values } = this.compile(`COUNT(DISTINCT (${key})) AS count`, false);
    const [row] = await rawQuery<{ count: string }>(this.host.kysely, text, values);
    return Number(row?.count ?? 0);
  }

  async getManyAndCount(): Promise<[TRecord[], number]> {
    return [await this.getMany(), await this.getCount()];
  }

  /** Строки как есть — для выражений из `select`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRawMany<TRow = any>(): Promise<TRow[]> {
    const selection = `${this.distinctRows ? 'DISTINCT ' : ''}${this.selections.length ? this.selections.join(', ') : `${this.alias}.*`}`;
    const { text, values } = this.compile(selection, true);
    return rawQuery<TRow>(this.host.kysely, text, values);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getRawOne<TRow = any>(): Promise<TRow | undefined> {
    const [row] = await this.getRawMany<TRow>();
    return row;
  }

  private join(kind: 'INNER' | 'LEFT', table: string, alias: string, on: string, params: Params): this {
    this.joins.push(`${kind} JOIN ${table} ${alias} ON ${on}`);
    Object.assign(this.params, params);
    return this;
  }

  private compile(selection: string, page: boolean): { text: string; values: unknown[] } {
    const parts = [`SELECT ${selection} FROM ${this.host.table} ${this.alias}`, ...this.joins];
    if (this.conditions.length) parts.push(`WHERE ${this.conditions.join(' AND ')}`);
    if (this.groups.length) parts.push(`GROUP BY ${this.groups.join(', ')}`);
    if (page && this.orders.length) parts.push(`ORDER BY ${this.orders.join(', ')}`);
    if (page && this.rowLimit !== undefined) parts.push(`LIMIT ${Number(this.rowLimit)}`);
    if (page && this.rowOffset) parts.push(`OFFSET ${Number(this.rowOffset)}`);
    return bindNamed(parts.join(' '), this.params);
  }
}

/**
 * Именованные параметры (`:имя`, перечень — `:...имя`) в нумерованные.
 * Приведение типа `::jsonb` параметром не считается.
 */
export function bindNamed(text: string, params: Params): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const bound = text.replace(/(?<![:\w]):(\.\.\.)?([A-Za-z_]\w*)/g, (match, spread: string | undefined, name: string) => {
    if (!(name in params)) throw new Error(`SQL parameter :${name} is not provided`);
    const value = params[name];
    if (!spread) return `$${values.push(value)}`;
    const list = value as unknown[];
    // Пустой перечень не подходит ни одной строке.
    if (list.length === 0) return 'NULL';
    return list.map((item) => `$${values.push(item)}`).join(', ');
  });
  return { text: bound, values };
}
