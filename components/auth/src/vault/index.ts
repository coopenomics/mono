/**
 * Vault-слой: client-side шифрование/расшифровка приватного ключа
 * (Argon2id + AES-256-GCM). Сервер хранит только зашифрованный блоб и не
 * может его расшифровать (type-driven ban в controller VaultService).
 */
export type { EncryptedVaultBlob, VaultSubject } from './types'
export { ARGON2ID_PARAMS, deriveKey } from './kdf'
export { decryptPrivateKey, encryptPrivateKey, fromB64Url } from './encrypt'
