import { argon2id } from 'hash-wasm'

/** Параметры Argon2id KDF (CoopID): зафиксированы версией `argon2id-v1`. */
export const ARGON2ID_PARAMS = {
  m: 65536, // 64 MiB
  t: 3,
  p: 4,
  dkLen: 32, // ключ AES-256
} as const

/**
 * Деривация 32-байтного ключа из пароля и соли (Argon2id).
 * Изоморфно: hash-wasm работает в браузере, Node и desktop-runtime; wasm-модуль
 * вшит в пакет base64-строкой, отдельного файла и сетевого запроса не требует.
 *
 * Почему НЕ @noble/hashes: его argon2 — чистый JS, и на этих параметрах одна
 * деривация занимает ~7 секунд, причём в главном потоке браузера. Вход по паролю
 * делает их две (расшифровать серверный vault + перешифровать локальный кэш), то
 * есть четырнадцать секунд, во время которых страница не отвечает — замирает даже
 * анимация загрузчика. Argon2 — стандарт с детерминированным результатом, поэтому
 * wasm-реализация выдаёт те же байты при тех же параметрах: ранее сохранённые
 * vault'ы читаются без перешифровки и без смены `kdf_version`. Проверено побайтовым
 * сравнением с прежней реализацией — совпадает, при этом быстрее вдесятеро.
 *
 * Параметры намеренно НЕ ослаблены: стойкость осталась прежней, ускорение дала
 * замена реализации.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return argon2id({
    password,
    salt,
    parallelism: ARGON2ID_PARAMS.p,
    iterations: ARGON2ID_PARAMS.t,
    memorySize: ARGON2ID_PARAMS.m,
    hashLength: ARGON2ID_PARAMS.dkLen,
    outputType: 'binary',
  })
}
