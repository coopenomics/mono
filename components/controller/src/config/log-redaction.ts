/**
 * Story 8.7 — маскирование sensitive-значений в логах (NFR9, защита в глубину).
 *
 * Если в meta лог-события протёк секрет (пароль, приватный ключ, токен, WIF,
 * мнемоника), его значение заменяется на `[REDACTED]` ДО записи в любой winston-
 * транспорт. В отличие от audit secret-blacklist (8.2/8.5), который БРОСАЕТ на
 * запретный КЛЮЧ, здесь маскируется ЗНАЧЕНИЕ: в логах ключ безопасен, опасно
 * значение, и логирование не должно ронять поток (last-resort защита).
 *
 * Набор паттернов — надмножество audit-blacklist: добавлены крипто-секреты CoopID
 * (wif/mnemonic/seed) и транспортные (authorization/cookie/api_key).
 */

export const REDACTED = '[REDACTED]';

/** Подстроки имён ключей, значение которых считаем секретом (case-insensitive). */
export const SENSITIVE_LOG_KEY_PATTERNS: readonly string[] = [
  'password',
  'passwd',
  'private_key',
  'privatekey',
  'secret',
  'token',
  'signature',
  'wif',
  'mnemonic',
  'seed',
  'credential',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
];

/** true, если имя ключа похоже на секрет (substring-матч без учёта регистра). */
export function isSensitiveLogKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_LOG_KEY_PATTERNS.some((p) => lower.includes(p));
}

/** plain-object — обходим рекурсивно; Error/Date/Buffer/класс-инстансы не трогаем. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Error || value instanceof Date) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Рекурсивно возвращает копию value, в которой значение любого секрет-ключа на
 * любом уровне вложенности заменено на `[REDACTED]`. Примитивы и неподдерживаемые
 * объекты возвращаются как есть. Циклы безопасны (WeakSet).
 */
export function redactSensitive<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    return value.map((item) => redactSensitive(item, seen)) as unknown as T;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = isSensitiveLogKey(key) ? REDACTED : redactSensitive(val, seen);
    }
    return out as unknown as T;
  }
  return value;
}
