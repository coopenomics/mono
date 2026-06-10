import type { EncryptedVaultBlob, VaultSubject } from './vault.types';

export const VAULT_REPOSITORY = Symbol('VaultRepository');

export interface IVaultRepository {
  /** Сохранить/обновить блоб по субъекту (upsert по subject_type+subject_id). */
  upsert(subject: VaultSubject, blob: EncryptedVaultBlob): Promise<void>;
  /** Зашифрованный блоб субъекта или null. */
  find(subject: VaultSubject): Promise<EncryptedVaultBlob | null>;
}
