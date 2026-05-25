/**
 * Порт списка применённых событий (consumer_dedup) — фундамент идемпотентности
 * (Story 2.1, INV-09).
 */
export interface ConsumerDedupRepositoryPort {
  /** Отмечено ли событие как уже применённое. Используется dedup-gate (Story 2.3). */
  isApplied(eventId: string): Promise<boolean>;

  /**
   * Отметить событие применённым. Идемпотентно (ON CONFLICT DO NOTHING): повтор
   * после краха между save и mark не должен падать.
   */
  markApplied(eventId: string): Promise<void>;

  /** Очистка меток старше cutoff (retention). Возвращает число удалённых строк. */
  deleteOlderThan(cutoff: Date): Promise<number>;
}

export const CONSUMER_DEDUP_REPOSITORY_PORT = Symbol('ConsumerDedupRepositoryPort');
