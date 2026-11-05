/**
 * Таблица в памяти для модульных тестов сервисов расширения: ведёт себя как
 * шлюз таблицы базы (`TableStore`) — условия отбора, порядок, предел,
 * уникальный ключ, обновление по условию. Суммы — десятичные строки базы.
 */

export function toUnits(value: unknown): bigint {
  const [int = '0', frac = ''] = (String(value ?? '0').trim().split(/\s+/)[0] ?? '0').split('.');
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4));
}

export function toAsset(units: bigint): string {
  const padded = units.toString().padStart(5, '0');
  return `${padded.slice(0, -4)}.${padded.slice(-4)} RUB`;
}

type Where = Record<string, any> | Array<Record<string, any>>;

/** Сравнение значений колонки: даты — по времени, десятичные суммы — по числу, прочее — как есть. */
function compare(a: any, b: any): number {
  const decimal = /^-?\d+(\.\d+)?$/;
  if (typeof a === 'string' && typeof b === 'string' && decimal.test(a) && decimal.test(b)) {
    const x = toUnits(a);
    const y = toUnits(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function matchesGroup(row: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (expected && typeof expected === 'object' && 'operator' in expected) {
      const value = row[key];
      switch (expected.operator) {
        case 'is null':
          return value == null;
        case 'is not null':
          return value != null;
        case '<':
          return value != null && compare(value, expected.value) < 0;
        case '<=':
          return value != null && compare(value, expected.value) <= 0;
        case '>':
          return value != null && compare(value, expected.value) > 0;
        case '>=':
          return value != null && compare(value, expected.value) >= 0;
        case 'in':
          return (expected.value as unknown[]).includes(value);
        default:
          throw new Error(`условие ${expected.operator} в таблице теста не описано`);
      }
    }
    return expected === null ? row[key] == null : row[key] === expected;
  });
}

/** Отбор шлюза таблицы: объект — условия через «и», перечень объектов — через «или». */
export function matches(row: any, where: Where): boolean {
  return Array.isArray(where) ? where.some((group) => matchesGroup(row, group)) : matchesGroup(row, where);
}

/**
 * Таблица в памяти с поведением шлюза базы: первичный ключ уникален (повторная
 * вставка падает, как в PostgreSQL), каждый запрос уступает очередь событий,
 * отбор понимает условия, порядок и предел, обновление идёт по условию сразу
 * по всем подходящим строкам.
 */
export function memoryTable<T extends object>(keyOf: (row: any) => string) {
  const rows = new Map<string, T>();
  const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
  const select = (where: Where, options: { order?: Record<string, 'ASC' | 'DESC'>; limit?: number; offset?: number } = {}) => {
    let list = [...rows.values()].filter((row) => matches(row, where));
    for (const [field, direction] of Object.entries(options.order ?? {})) {
      list = list.sort((a: any, b: any) => compare(a[field], b[field]) * (direction === 'DESC' ? -1 : 1));
    }
    const offset = options.offset ?? 0;
    return list.slice(offset, options.limit === undefined ? undefined : offset + options.limit);
  };
  const table = {
    rows,
    /** Следующая вставка упадёт с этой ошибкой — сбой базы. */
    failNextInsert: null as Error | null,
    async findOne(where: Where): Promise<T | null> {
      await yieldTurn();
      return select(where)[0] ?? null;
    },
    async find(where: Where = {}, options?: any): Promise<T[]> {
      await yieldTurn();
      return select(where, options);
    },
    async findAndCount(where: Where, options?: any): Promise<[T[], number]> {
      await yieldTurn();
      return [select(where, options), select(where).length];
    },
    async insert(fields: any): Promise<T> {
      await yieldTurn();
      if (table.failNextInsert) {
        const error = table.failNextInsert;
        table.failNextInsert = null;
        throw error;
      }
      const key = keyOf(fields);
      if (rows.has(key)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      const row = { created_at: new Date(), updated_at: new Date(), ...fields } as T;
      rows.set(key, row);
      return row;
    },
    async update(where: Where, patch: any): Promise<number> {
      await yieldTurn();
      const hit = [...rows.entries()].filter(([, row]) => matches(row, where));
      for (const [key, row] of hit) rows.set(key, { ...row, ...patch });
      return hit.length;
    },
  };
  return table;
}
