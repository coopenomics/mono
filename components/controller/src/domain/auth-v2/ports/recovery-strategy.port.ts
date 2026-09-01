import type { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';

/**
 * Порт хранилища recovery-стратегии пайщика (CoopID, Story 3.5).
 * Одна запись на пайщика (subject_id = user.id). Отсутствие записи трактуется
 * как стратегия по умолчанию (email magic-link) на уровне сервиса.
 */
export const RECOVERY_STRATEGY_REPOSITORY = Symbol('RecoveryStrategyRepository');

export interface IRecoveryStrategyRepository {
  /** Текущая стратегия пайщика либо null, если не задавалась. */
  get(subjectId: string): Promise<RecoveryStrategy | null>;
  /** Установить/сменить стратегию пайщика. */
  set(subjectId: string, strategy: RecoveryStrategy): Promise<void>;
}
