/** Субъект, к которому привязан зашифрованный блоб (AAD). */
export interface VaultSubject {
  subject_type: 'participant' | 'coop' | 'council_action'
  subject_id: string
}

/** Зашифрованный блоб vault'а: всё, что хранит и отдаёт сервер. base64url-поля. */
export interface EncryptedVaultBlob {
  cipher_version: string
  kdf_version: string
  salt: string
  nonce: string
  ciphertext: string
  auth_tag: string
}
