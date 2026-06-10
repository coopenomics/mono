/**
 * Vault-слой: client-side расшифровка приватного ключа (Argon2id + AES-256-GCM).
 * Пока только форма зашифрованного блоба; функции расшифровки и type-driven
 * запрет серверной расшифровки приходят в Stories 2.1–2.2.
 */

export interface EncryptedVaultBlob {
  cipher_version: string
  kdf_version: string
  salt: string
  nonce: string
  ciphertext: string
  auth_tag: string
}
