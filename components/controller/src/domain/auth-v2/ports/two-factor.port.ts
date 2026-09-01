/**
 * Порты второго фактора (TOTP / Google Authenticator) — CoopID Story 3.6.
 *
 * Базовый второй независимый канал MVP — код из приложения-аутентификатора
 * (решение владельца 2026-06-10, заменяет magic-link-toggle из исходного AC).
 * Используется и recovery-подтверждением (Story 3.2), и 2FA-входом.
 *
 * Секрет хранится зашифрованным server-key (НЕ ключ пайщика — инвариант vault
 * не затрагивается: сервер обязан читать TOTP-секрет, чтобы проверять коды).
 */

export const TWO_FACTOR_REPOSITORY = Symbol('TwoFactorRepository');
export const TWO_FACTOR_VERIFIER = Symbol('TwoFactorVerifier');

/** Запись второго фактора пайщика. `enabled=false` — секрет выпущен, но enrollment не подтверждён первым кодом. */
export interface TwoFactorRecord {
  subjectId: string;
  /** Base32-секрет, зашифрованный server-key (формат aes.ts `iv:cipher`). */
  secretEnc: string;
  enabled: boolean;
}

export interface ITwoFactorRepository {
  get(subjectId: string): Promise<TwoFactorRecord | null>;
  /** Выпустить/перевыпустить секрет в состоянии «ожидает подтверждения» (enabled=false). */
  putPending(subjectId: string, secretEnc: string): Promise<void>;
  /** Подтвердить enrollment (enabled=true). */
  enable(subjectId: string): Promise<void>;
  /** Снять второй фактор. */
  remove(subjectId: string): Promise<void>;
}

/**
 * Узкий порт «проверить второй фактор» — то, что нужно потребителям (recovery,
 * 2FA-вход), без доступа к управлению секретом. Реализуется `TwoFactorService`.
 */
export interface ITwoFactorVerifier {
  /** Подключён ли активный второй фактор у пайщика. */
  isEnabled(subjectId: string): Promise<boolean>;
  /** Проверить TOTP-код против активного секрета. false, если 2FA не подключён или код неверен. */
  verify(subjectId: string, code: string): Promise<boolean>;
}
