/**
 * Порт списка применённых событий (consumer_dedup) — фундамент идемпотентности
 * (Story 2.1, INV-09).
 */
export interface ConsumerDedupRepositoryPort {
  /** Отмечено ли событие как уже применённое. Используется dedup-gate (Story 2.3). */
  isApplied(eventId: string): Promise<boolean>;

  /**
   * Отметить событие применённым. Идемпотентно (ON CONFLICT DO NOTHING): повтор
   * после краха между save и mark не должен падать. blockNum — номер блока события
   * (Story 4.1, для последующего deleteAfterBlock на форке); опциональный для
   * backward-compat с местами, где блок неизвестен (например, ручные тесты).
   */
  markApplied(eventId: string, blockNum?: number): Promise<void>;

  /** Очистка меток старше cutoff (retention). Возвращает число удалённых строк. */
  deleteOlderThan(cutoff: Date): Promise<number>;

  /**
   * Удалить метки событий с block_num > blockNum — для очистки дедупа на форке
   * (Story 4.1, ADR-005). Записи с NULL block_num (legacy до Epic 4) НЕ затрагиваются:
   * PG сравнение NULL > N даёт unknown и не попадает под WHERE. Возвращает число строк.
   */
  deleteAfterBlock(blockNum: number): Promise<number>;
}

export const CONSUMER_DEDUP_REPOSITORY_PORT = Symbol('ConsumerDedupRepositoryPort');
