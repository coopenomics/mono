import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { deriveKey } from './kdf'
import type { EncryptedVaultBlob, VaultSubject } from './types'

const CIPHER_VERSION = 'aes-256-gcm-v1'
const KDF_VERSION = 'argon2id-v1'
const SALT_LEN = 16
const NONCE_LEN = 12

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * AAD GCM привязывает шифртекст к ТИПУ субъекта (`participant`/`coop`/…), но НЕ к
 * конкретному account-id. Раньше было `${type}|${id}` — это требовало знать
 * username ещё до confirm при восстановлении (Эпик 12), хотя сервер и так
 * резолвит account из recovery-токена; так родился лишний whoami-by-token.
 *
 * Account-id убран из AAD намеренно (решение владельца 2026-06-15): пер-юзер
 * привязку даёт пароль + случайная соль, лежащая в самом блобе; контролем доступа
 * AAD здесь не был (блоб и так публично читается по account через `GET /coop/vault`).
 * Поэтому теперь клиент шифрует новый ключ просто паролём, а account для
 * последующей выборки/расшифровки блоба берёт из ответа confirm.
 */
function aad(subject: VaultSubject): string {
  return subject.subject_type
}

/** WebCrypto в strict-TS требует ArrayBuffer-backed view; нормализуем Uint8Array. */
function buf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

/**
 * Subject-агностичное ядро (Story 2.2): Argon2id(пароль, salt) → AES-256-GCM с
 * произвольной AAD-строкой. Поверх него работает vault приватного ключа
 * (AAD=субъект). PIN-слой (AAD=`pin|<account>`) снят в 11.8 (модель «без PIN»).
 */
export async function encryptWithPassword(
  plaintext: string,
  password: string,
  additionalData: string,
): Promise<EncryptedVaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN))
  const keyBytes = deriveKey(password, salt)

  const key = await crypto.subtle.importKey('raw', buf(keyBytes), { name: 'AES-GCM' }, false, ['encrypt'])
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buf(nonce), additionalData: buf(new TextEncoder().encode(additionalData)) },
      key,
      buf(new TextEncoder().encode(plaintext)),
    ),
  )
  // WebCrypto склеивает ciphertext+tag; tag GCM — последние 16 байт.
  const tagLen = 16
  const ciphertext = sealed.slice(0, sealed.length - tagLen)
  const authTag = sealed.slice(sealed.length - tagLen)

  return {
    cipher_version: CIPHER_VERSION,
    kdf_version: KDF_VERSION,
    salt: toB64Url(salt),
    nonce: toB64Url(nonce),
    ciphertext: toB64Url(ciphertext),
    auth_tag: toB64Url(authTag),
  }
}

/** Парная расшифровка ядра; неверный пароль/AAD → `VaultDecryptionFailed`. */
export async function decryptWithPassword(
  blob: EncryptedVaultBlob,
  password: string,
  additionalData: string,
): Promise<string> {
  const keyBytes = deriveKey(password, fromB64Url(blob.salt))
  const key = await crypto.subtle.importKey('raw', buf(keyBytes), { name: 'AES-GCM' }, false, ['decrypt'])
  const sealed = new Uint8Array([...fromB64Url(blob.ciphertext), ...fromB64Url(blob.auth_tag)])
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(fromB64Url(blob.nonce)), additionalData: buf(new TextEncoder().encode(additionalData)) },
      key,
      buf(sealed),
    )
    return new TextDecoder().decode(plain)
  } catch {
    throw new AuthV2Error(AuthV2ErrorCode.VaultDecryptionFailed, 'Не удалось расшифровать: неверный пароль или повреждённые данные')
  }
}

/**
 * Клиентское шифрование приватного ключа пайщика (Story 2.1). Сервер получает
 * только результат — расшифровать может лишь владелец пароля (AAD=субъект).
 */
export async function encryptPrivateKey(
  privateKey: string,
  password: string,
  subject: VaultSubject,
): Promise<EncryptedVaultBlob> {
  return encryptWithPassword(privateKey, password, aad(subject))
}

/**
 * Локальная расшифровка (round-trip тесты и keystore 2.2). Серверу недоступна —
 * type-driven ban (см. controller VaultService).
 */
export async function decryptPrivateKey(
  blob: EncryptedVaultBlob,
  password: string,
  subject: VaultSubject,
): Promise<string> {
  return decryptWithPassword(blob, password, aad(subject))
}
