/**
 * Приведение float-полей таблиц блокчейна к JS-числам.
 *
 * WHY: `Float.toJSON()` в @wharfkit/antelope отдаёт `toString()`, поэтому любое поле
 * `float32`/`float64`, прочитанное по RPC, приходит строкой (`"61.804697156983934"`).
 * Парсер те же поля отдаёт числом — ABI-декодер SHiP разворачивает их в `number`.
 * Один и тот же проект, записанный разными путями, получал в БД разные типы, а
 * последующая арифметика (`sum + value`) вместо сложения выполняла конкатенацию строк:
 * среднее по процентам уезжало в NaN и роняло сериализацию GraphQL Float на всём списке.
 *
 * Инвариант: наружу из RPC-транспорта float'ы уходят только числами.
 * Список полей не ведётся руками — типы берутся из ABI, поэтому новые float-поля
 * контрактов нормализуются автоматически.
 */

/** Минимальная форма ABI, достаточная для обхода типов таблицы. */
interface AbiFieldLike {
  name: unknown;
  type: unknown;
}

interface AbiStructLike {
  name: unknown;
  base?: unknown;
  fields?: AbiFieldLike[];
}

interface AbiTableLike {
  name: unknown;
  type: unknown;
}

export interface AbiLike {
  structs?: AbiStructLike[];
  tables?: AbiTableLike[];
}

const FLOAT_TYPES = new Set(['float32', 'float64']);

/** Защита от взаимно рекурсивных структур в ABI. */
const MAX_DEPTH = 16;

/**
 * Отбрасывает суффиксы ABI-типа: `float64[]`, `float64?`, `float64$`.
 */
function parseType(rawType: string): { type: string; isArray: boolean } {
  let type = rawType;
  let isArray = false;

  if (type.endsWith('$')) type = type.slice(0, -1);
  if (type.endsWith('?')) type = type.slice(0, -1);
  if (type.endsWith('[]')) {
    type = type.slice(0, -2);
    isArray = true;
  }

  return { type, isArray };
}

/**
 * Значения, которые не приводятся к конечному числу (`"nan"`, `"inf"`, мусор), становятся нулём:
 * GraphQL Float не умеет сериализовать ни NaN, ни Infinity, и один такой ряд роняет весь ответ.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Собирает поля структуры вместе с полями базовых структур.
 */
function collectFields(structName: string, structs: Map<string, AbiStructLike>, depth: number): AbiFieldLike[] {
  if (depth > MAX_DEPTH) return [];

  const struct = structs.get(structName);
  if (!struct) return [];

  const base = typeof struct.base === 'string' ? struct.base : String(struct.base ?? '');
  const inherited = base ? collectFields(base, structs, depth + 1) : [];

  return [...inherited, ...(struct.fields ?? [])];
}

function normalizeStruct(value: unknown, structName: string, structs: Map<string, AbiStructLike>, depth: number): unknown {
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((item) => normalizeStruct(item, structName, structs, depth + 1));
  }

  const fields = collectFields(structName, structs, depth);
  if (fields.length === 0) return value;

  const target = value as Record<string, unknown>;

  for (const field of fields) {
    const fieldName = String(field.name);
    if (!(fieldName in target)) continue;

    const { type, isArray } = parseType(String(field.type));
    const fieldValue = target[fieldName];
    if (fieldValue === null || fieldValue === undefined) continue;

    if (FLOAT_TYPES.has(type)) {
      target[fieldName] =
        isArray && Array.isArray(fieldValue) ? fieldValue.map(toFiniteNumber) : toFiniteNumber(fieldValue);
      continue;
    }

    if (structs.has(type)) {
      target[fieldName] = normalizeStruct(fieldValue, type, structs, depth + 1);
    }
  }

  return target;
}

/**
 * Приводит float-поля прочитанных рядов таблицы к числам, опираясь на типы из ABI контракта.
 *
 * Работает по месту (ряды уже являются результатом `JSON.parse`, своей копией владеет вызывающий).
 * Если таблицы или её структуры нет в ABI — значение возвращается как есть.
 */
export function normalizeAbiFloats<T>(value: T, abi: AbiLike | null | undefined, tableName: string): T {
  if (!value || !abi?.structs?.length) return value;

  const table = abi.tables?.find((candidate) => String(candidate.name) === tableName);
  const structName = table ? String(table.type) : undefined;
  if (!structName) return value;

  const structs = new Map<string, AbiStructLike>();
  for (const struct of abi.structs) {
    structs.set(String(struct.name), struct);
  }

  return normalizeStruct(value, structName, structs, 0) as T;
}
