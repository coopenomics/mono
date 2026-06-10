import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';

/**
 * Порт финализации восстановления доступа (CoopID, сейм Story 3.3).
 *
 * После того как двухканальное подтверждение (magic-link + TOTP, Story 3.2)
 * пройдено, фактическая ротация ключа — единая атомарная операция:
 *   1. COOPOS `updateauth` новым публичным ключом пайщика (service-account);
 *   2. установка нового пароля в authentik;
 *   3. запись нового зашифрованного vault-блоба;
 *   4. отзыв всех активных сессий пайщика;
 *   5. `audit KeyRotated reason=recovery`.
 *
 * Story 3.2 определяет контракт и оркестрацию вокруг него; реализацию (с внешними
 * зависимостями COOPOS/authentik) приносит Story 3.3. Частичная финализация
 * запрещена — рассинхрон ключа блокирует пайщика.
 */
export const RECOVERY_FINALIZATION_PORT = Symbol('RecoveryFinalizationPort');

/** Материал финализации. Секреты (`newPassword`, `vaultBlob`) живут только в памяти запроса — НЕ хранятся. */
export interface RecoveryFinalizationInput {
  /** UUID пайщика (user.id). */
  subjectId: string;
  /** Имя аккаунта пайщика в кооперативе. */
  username: string;
  /** Кооператив-владелец запроса. */
  coopname: string;
  /** Новый публичный ключ пайщика — для COOPOS `updateauth`. */
  newPublicKey: string;
  /** Новый зашифрованный vault-блоб (новая пара ключей под новым паролем) — собран на клиенте. */
  vaultBlob: EncryptedVaultBlob;
  /** Новый пароль — для authentik. Только in-memory запроса, не сохраняется (решение владельца). */
  newPassword: string;
}

export interface IRecoveryFinalization {
  /** Атомарно завершить восстановление: ротация ключа + пароль + vault + отзыв сессий. */
  finalize(input: RecoveryFinalizationInput): Promise<void>;
}
