import { argon2id } from '@noble/hashes/argon2'

/** Параметры Argon2id KDF (CoopID): зафиксированы версией `argon2id-v1`. */
export const ARGON2ID_PARAMS = {
  m: 65536, // 64 MiB
  t: 3,
  p: 4,
  dkLen: 32, // ключ AES-256
} as const

/**
 * Деривация 32-байтного ключа из пароля и соли (Argon2id).
 * Изоморфно: @noble/hashes работает в браузере, Node и desktop-runtime.
 */
export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return argon2id(new TextEncoder().encode(password), salt, ARGON2ID_PARAMS)
}
