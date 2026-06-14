import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';

/**
 * Порт финализации восстановления доступа (CoopID, сейм Story 3.3).
 *
 * После того как двухканальное подтверждение (magic-link + TOTP, Story 3.2)
 * пройдено, фактическая финализация — единая операция:
 *   1. запись нового пароля в authentik (admin set_password, Story 12.1);
 *   2. запись нового зашифрованного vault-блоба (новый приватный ключ живёт только в нём);
 *   3. ротация active-ключа в COOPOS через `registrator::changekey` (подпись ключом кооператива);
 *   4. отзыв всех активных сессий пайщика;
 *   5. `audit KeyRotated` (Story 8.4) + уведомление пайщика о перевыпуске ключа.
 *
 * Порядок setPassword→vault→changekey намеренный: запись во внешний authentik — самый
 * вероятный сбой и делается первой (её отказ не трогает vault/цепь → откат на старые
 * креды); vault — ДО on-chain переключения (новый приватный ключ существует только в
 * блобе, changekey коммитит его последним и ретраится). Иначе сбой между шагами мог бы
 * залочить пайщика. Реализация — `RecoveryFinalizationService` (Story 3.3 + 12.1).
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
  /** Новый пароль — пишется в authentik admin set_password (Story 12.1). Только in-memory запроса, не сохраняется/не логируется. */
  newPassword: string;
  /** IP инициатора — для аудита KeyRotated и уведомления о ротации. */
  ip?: string | null;
  /** Что инициировало ротацию (для аудита). По умолчанию self-recovery. */
  trigger?: 'recovery' | 'force_recovery';
}

export interface IRecoveryFinalization {
  /** Атомарно завершить восстановление: ротация ключа + пароль + vault + отзыв сессий. */
  finalize(input: RecoveryFinalizationInput): Promise<void>;
}
