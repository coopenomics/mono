/**
 * Стратегия восстановления доступа пайщика (CoopID, Story 3.5). Ровно одна активна;
 * она определяет, какой входной канал recovery разрешён.
 */
export enum RecoveryStrategy {
  /** Email magic-link (по умолчанию, Story 3.1). */
  EmailMagicLink = 'email_magic_link',
  /** Печатный offline-код (Story 3.4). */
  OfflineCode = 'offline_code',
  /** Решение совета (multi-party) — только approval-flow Эпика 6 (Story 6.9). */
  Council = 'council',
}

/** Стратегия по умолчанию, если пайщик ничего не выбирал (обратная совместимость с 3.1). */
export const DEFAULT_RECOVERY_STRATEGY = RecoveryStrategy.EmailMagicLink;

/** Является ли значение валидной стратегией. */
export function isRecoveryStrategy(value: unknown): value is RecoveryStrategy {
  return typeof value === 'string' && (Object.values(RecoveryStrategy) as string[]).includes(value);
}
