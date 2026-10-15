/**
 * Заглушка для клиентской сборки: импорт `node:crypto` в браузере не существует.
 * `Crypto.sha256` в UI использует Web Crypto API; этот модуль не должен вызываться.
 */
export function createHash(algorithm: string): never {
  void algorithm
  // i18n-ignore: техническая заглушка для сборщика, пользователь её не видит
  throw new Error('node:crypto недоступен в браузерной сборке')
}
