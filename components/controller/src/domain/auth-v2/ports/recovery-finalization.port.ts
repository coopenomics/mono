import type { EncryptedVaultBlob } from '~/domain/auth-v2/vault/vault.types';

/**
 * Порт финализации восстановления доступа (CoopID, сейм Story 3.3).
 *
 * После того как двухканальное подтверждение (magic-link + TOTP, Story 3.2)
 * пройдено, фактическая ротация ключа — единая операция:
 *   1. запись нового зашифрованного vault-блоба (новый приватный ключ живёт только в нём);
 *   2. ротация active-ключа в COOPOS через `registrator::changekey` (подпись ключом кооператива);
 *   3. отзыв всех активных сессий пайщика;
 *   4. `audit KeyRotated` (Story 8.4) + уведомление пайщика о перевыпуске ключа.
 *
 * Пароль authentik в recovery на этом шаге НЕ трогается — это Эпик 5 (контроллер пока
 * умеет только ЧИТАТЬ authentik; запись пароля = его интеграция). Порядок vault→changekey
 * намеренный: новый приватный ключ существует только в блобе, поэтому он сохраняется ДО
 * on-chain переключения — иначе сбой между шагами мог бы залочить пайщика.
 * Реализация — `RecoveryFinalizationService` (Story 3.3).
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
  /** Новый пароль — для authentik. Используется в Эпике 5 (запись пароля в authentik); Story 3.3 его НЕ трогает. Только in-memory запроса, не сохраняется. */
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
