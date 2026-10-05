import { sql, type Expression, type ExpressionBuilder, type Kysely, type SqlBool } from 'kysely';
import { affectedCount, camelRow } from './kysely';
import { SqlBuilder } from './sql-builder';

/* eslint-disable @typescript-eslint/no-explicit-any */

const CONDITION = Symbol('TableStore.Condition');

interface Condition {
  [CONDITION]: true;
  operator: string;
  value?: unknown;
}

const condition = (operator: string, value?: unknown): any => ({ [CONDITION]: true, operator, value });

/** Значение колонки пусто. */
export const isNull = (): any => condition('is null');
/** Значение колонки задано. */
export const notNull = (): any => condition('is not null');
/** Значение колонки не равно заданному. */
export const notEqual = <T>(value: T): any => condition('<>', value);
/** Значение колонки меньше заданного. */
export const lessThan = <T>(value: T): any => condition('<', value);
/** Значение колонки больше заданного. */
export const moreThan = <T>(value: T): any => condition('>', value);
/** Значение колонки не больше заданного. */
export const lessOrEqual = <T>(value: T): any => condition('<=', value);
/** Значение колонки не меньше заданного. */
export const moreOrEqual = <T>(value: T): any => condition('>=', value);
/** Значение колонки подходит под шаблон LIKE без учёта регистра. */
export const ilike = (pattern: string): any => condition('ilike', pattern);
/** Значение колонки — одно из перечня. */
export const oneOf = <T>(values: readonly T[]): any => condition('in', values);
/** Значение колонки в границах (обе включительно); незаданная граница не ограничивает. */
export const within = <T>(from?: T | null, to?: T | null): any => condition('range', [from, to]);
/** Json-колонка содержит заданный фрагмент (оператор `@>`). */
export const contains = (fragment: unknown): any => condition('contains', fragment);

/** Условие отбора: равенство по полям либо условие из помощников выше; массив — «или». */
export type Where<TRecord> = { [K in keyof TRecord]?: unknown };
export type WhereInput<TRecord> = Where<TRecord> | Where<TRecord>[];

export interface FindOptions<TRecord> {
  order?: { [K in keyof TRecord]?: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

export interface TableStoreOptions<TRecord> {
  table: string;
  /** Поля первичного ключа записи. */
  primaryKey: Array<keyof TRecord & string>;
  /** Поля json/jsonb: при записи сериализуются. */
  json?: Array<keyof TRecord & string>;
  /** Поля numeric/bigint: база отдаёт их строкой, в записи они числа. */
  numbers?: Array<keyof TRecord & string>;
  /** Поля типа `date` (без времени): драйвер отдаёт дату объектом, в записи она строка `ГГГГ-ММ-ДД`. */
  dates?: Array<keyof TRecord & string>;
  /** Поле времени правки: при каждой правке ставится текущее время базы. */
  updatedAt?: keyof TRecord & string;
  /** Поля записи — перечень, из которого выбирается поле сортировки по запросу клиента. */
  columns?: Array<keyof TRecord & string>;
  /** Имена колонок совпадают с именами полей (иначе поле `camelCase` — колонка `snake_case`). */
  sameNames?: boolean;
}

const toSnake = (key: string): string => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/**
 * Шлюз одной таблицы для кода, который работает с записями целиком: прочитал,
 * поправил, сохранил (C28-81). Запросы — обычные запросы Kysely; отбор — по
 * равенству полей и простым условиям. Всё сложнее (соединения, агрегаты,
 * подзапросы) пишется в хранилище прямо на Kysely.
 */
export class TableStore<TRecord extends object> {
  private readonly json: Set<string>;
  private readonly numbers: string[];

  constructor(private readonly db: Kysely<any>, private readonly options: TableStoreOptions<TRecord>) {
    this.json = new Set(options.json ?? []);
    this.numbers = options.numbers ?? [];
  }

  /** Тот же шлюз на другом соединении — внутри транзакции `inTransaction`. */
  on(db: Kysely<any>): TableStore<TRecord> {
    return new TableStore<TRecord>(db, this.options);
  }

  /** Имя таблицы шлюза. */
  get table(): string {
    return this.options.table;
  }

  /**
   * Поле сортировки по запросу клиента: только из перечня полей записи, иначе
   * умолчание. Имя вне перечня до запроса не доходит.
   */
  sortField(requested: string | undefined, fallback: keyof TRecord & string): keyof TRecord & string {
    const known = (this.options.columns ?? []) as string[];
    return requested && known.includes(requested) ? (requested as keyof TRecord & string) : fallback;
  }

  /** Сборщик выборки из фрагментов SQL с именованными параметрами: соединения, подзапросы, агрегаты. */
  sqlBuilder(alias: string): SqlBuilder<TRecord> {
    return new SqlBuilder<TRecord>(
      { kysely: this.db, table: this.options.table, primaryKey: this.options.primaryKey.map((field) => this.column(field)), records: (rows) => this.records(rows) },
      alias
    );
  }

  /** Kysely этого шлюза — для запросов сложнее отбора по равенству. */
  get kysely(): Kysely<any> {
    return this.db;
  }

  /** Начало выборки из таблицы шлюза: все колонки, условия дописывает вызывающий. */
  select() {
    return this.db.selectFrom(this.options.table).selectAll();
  }

  /** Строки базы, полученные своим запросом, в записи шлюза. */
  records(rows: Array<Record<string, unknown>>): TRecord[] {
    return rows.map((row) => this.toRecord(row));
  }

  /** Заготовка записи: обычный объект, в базу не пишется. */
  create(fields: Partial<TRecord>): TRecord {
    return { ...fields } as TRecord;
  }

  async findOne(where: WhereInput<TRecord>, options: FindOptions<TRecord> = {}): Promise<TRecord | null> {
    const [record] = await this.find(where, { ...options, limit: 1 });
    return record ?? null;
  }

  /** Запись по условию; нет такой — ошибка: вызывающий уверен, что она есть. */
  async findOneOrFail(where: WhereInput<TRecord>): Promise<TRecord> {
    const record = await this.findOne(where);
    if (!record) throw new Error(`No ${this.options.table} row matches the condition`);
    return record;
  }

  async find(where: WhereInput<TRecord> = {}, options: FindOptions<TRecord> = {}): Promise<TRecord[]> {
    let query = this.db.selectFrom(this.options.table).selectAll().where((eb) => this.filter(eb, where));
    for (const [field, direction] of Object.entries(options.order ?? {})) {
      query = query.orderBy(this.column(field), direction === 'DESC' ? 'desc' : 'asc');
    }
    if (options.offset) query = query.offset(options.offset);
    if (options.limit) query = query.limit(options.limit);
    return (await query.execute()).map((row) => this.toRecord(row));
  }

  /** Страница записей и общее число подходящих. */
  async findAndCount(where: WhereInput<TRecord> = {}, options: FindOptions<TRecord> = {}): Promise<[TRecord[], number]> {
    return [await this.find(where, options), await this.count(where)];
  }

  async exists(where: WhereInput<TRecord>): Promise<boolean> {
    return (await this.findOne(where)) !== null;
  }

  async count(where: WhereInput<TRecord> = {}): Promise<number> {
    const row = await this.db
      .selectFrom(this.options.table)
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where((eb) => this.filter(eb, where))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  /** Вставка новой записи; возвращает её с ключом и умолчаниями базы. */
  async insert(fields: Partial<TRecord>): Promise<TRecord> {
    const row = await this.db.insertInto(this.options.table).values(this.toRow(fields)).returningAll().executeTakeFirstOrThrow();
    return this.toRecord(row);
  }

  /**
   * Сохранение записи: с заданным ключом — вставка либо правка существующей,
   * без ключа — вставка. Переданный объект дополняется тем, что вернула база
   * (ключ, даты, умолчания), и возвращается.
   */
  async save(record: Partial<TRecord>): Promise<TRecord>;
  async save(records: Array<Partial<TRecord>>): Promise<TRecord[]>;
  async save(record: Partial<TRecord> | Array<Partial<TRecord>>): Promise<TRecord | TRecord[]> {
    // Перечень записей сохраняется по очереди — каждая как одиночная.
    if (Array.isArray(record)) return this.saveMany(record);
    const row = this.toRow(record);
    const keys = this.options.primaryKey.map((field) => this.column(field));
    const hasKey = keys.every((key) => row[key] !== undefined && row[key] !== null);
    const insert = this.db.insertInto(this.options.table).values(row);
    const saved = await (hasKey
      ? insert.onConflict((conflict) => conflict.columns(keys).doUpdateSet(this.changes(row, keys)))
      : insert
    )
      .returningAll()
      .executeTakeFirstOrThrow();
    return Object.assign(record, this.toRecord(saved)) as TRecord;
  }

  /** Сохранение нескольких записей по очереди — каждая как в `save`. */
  async saveMany(records: Array<Partial<TRecord>>): Promise<TRecord[]> {
    const saved: TRecord[] = [];
    for (const record of records) saved.push(await this.save(record));
    return saved;
  }

  /** Правка записей по условию; возвращает число затронутых. */
  async update(where: WhereInput<TRecord>, patch: Partial<TRecord>): Promise<number> {
    const result = await this.db
      .updateTable(this.options.table)
      .set(this.changes(this.toRow(patch), []))
      .where((eb) => this.filter(eb, where))
      .execute();
    return affectedCount(result);
  }

  /** Удаление записей по условию; возвращает число удалённых. */
  async delete(where: WhereInput<TRecord>): Promise<number> {
    const result = await this.db
      .deleteFrom(this.options.table)
      .where((eb) => this.filter(eb, where))
      .execute();
    return affectedCount(result);
  }

  private column(field: string): string {
    return this.options.sameNames ? field : toSnake(field);
  }

  /** Значения колонок из полей записи; незаданные поля пропускаются. */
  private toRow(fields: Partial<TRecord>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      row[this.column(field)] = this.json.has(field) && value !== null ? JSON.stringify(value) : value;
    }
    return row;
  }

  private toRecord(row: Record<string, unknown>): TRecord {
    const record = (this.options.sameNames ? { ...row } : camelRow<Record<string, unknown>>(row)) as Record<string, unknown>;
    for (const field of this.numbers) {
      if (record[field] !== null && record[field] !== undefined) record[field] = Number(record[field]);
    }
    for (const field of this.options.dates ?? []) {
      if (record[field] instanceof Date) record[field] = dateOnly(record[field] as Date);
    }
    return record as TRecord;
  }

  /** Колонки к правке: всё переданное, кроме ключа, плюс время правки. */
  private changes(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const set = Object.fromEntries(Object.entries(row).filter(([column]) => !keys.includes(column)));
    if (this.options.updatedAt) set[this.column(this.options.updatedAt)] = sql`now()`;
    // Правка без единого поля — запись остаётся как есть: ключ переписывается сам в себя.
    if (Object.keys(set).length === 0 && keys.length > 0) set[keys[0]] = sql.ref(`excluded.${keys[0]}`);
    return set;
  }

  private filter(eb: ExpressionBuilder<any, any>, where: WhereInput<TRecord>): Expression<SqlBool> {
    const groups = Array.isArray(where) ? where : [where];
    // Незаданное значение условия не даёт — отбор по остальным полям, как у прежней прослойки.
    const clauses = (group: object) =>
      Object.entries(group)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => this.clause(eb, field, value));
    return eb.or(groups.map((group) => eb.and(clauses(group))));
  }

  private clause(eb: ExpressionBuilder<any, any>, field: string, value: unknown): Expression<SqlBool> {
    const column = this.column(field);
    if (value === null) return eb(column, 'is', null);
    if (value !== undefined && typeof value === 'object' && CONDITION in (value as object)) {
      const { operator, value: operand } = value as Condition;
      if (operator === 'is null') return eb(column, 'is', null);
      if (operator === 'is not null') return eb(column, 'is not', null);
      if (operator === 'range') {
        const [from, to] = operand as [unknown, unknown];
        const bounds: Expression<SqlBool>[] = [];
        if (from !== null && from !== undefined) bounds.push(eb(column, '>=', from));
        if (to !== null && to !== undefined) bounds.push(eb(column, '<=', to));
        return eb.and(bounds);
      }
      if (operator === 'contains') return sql<boolean>`${sql.ref(column)} @> ${JSON.stringify(operand)}::jsonb`;
      if (operator === 'in') return (operand as unknown[]).length ? eb(column, 'in', operand as unknown[]) : sql<boolean>`false`;
      return eb(column, operator as '=', operand);
    }
    return eb(column, '=', value);
  }
}

/** Дата без времени строкой `ГГГГ-ММ-ДД`: драйвер разбирает её в местную полночь, поэтому берутся местные части. */
function dateOnly(value: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
