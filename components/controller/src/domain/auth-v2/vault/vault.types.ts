export type VaultSubjectType = 'participant' | 'coop' | 'council_action';

export interface VaultSubject {
  subject_type: VaultSubjectType;
  subject_id: string;
}

/** Зашифрованный блоб — всё, что сервер хранит и отдаёт (base64url-строки). */
export interface EncryptedVaultBlob {
  cipher_version: string;
  kdf_version: string;
  salt: string;
  nonce: string;
  ciphertext: string;
  auth_tag: string;
}

/**
 * Type-driven decryption ban: для `participant` входной тип НЕ содержит
 * никакого секрета разблокировки — серверная расшифровка невозможна по типам.
 * coop/council_action разблокируются service-account ключом (вне scope 2.1).
 */
export type RetrieveVaultInput =
  | { subject_type: 'participant'; subject_id: string }
  | { subject_type: 'coop' | 'council_action'; subject_id: string };
