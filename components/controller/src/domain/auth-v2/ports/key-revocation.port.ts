/**
 * Порт ручного отзыва ключа пайщика (CoopID, Story 4.7). Председатель по сообщению о
 * компрометации отзывает ключ; запись в coop_domain_db (`revoked_keys`, V2.4.10) служит
 * durable pending-state: пока `recoveredAt === null` — ключ отозван, пайщик обязан пройти
 * recovery (Эпик 3). Полный compromised-key registry с авто-проверкой при verify — Growth.
 */

/** Запись отзыва ключа. */
export interface KeyRevocation {
  id: string;
  targetId: string;
  reason: string;
  /** Председатель, инициировавший отзыв (для audit-трейла). */
  revokedBy: string;
  revokedAt: string;
  /** Заполняется по завершении recovery (Эпик 3); null — отзыв активен. */
  recoveredAt: string | null;
}

/** Данные нового отзыва. */
export interface NewKeyRevocation {
  targetId: string;
  reason: string;
  revokedBy: string;
}

export const KEY_REVOCATION_REPOSITORY = Symbol('KeyRevocationRepository');

export interface IKeyRevocationRepository {
  /** Зафиксировать отзыв (pending-state до recovery). */
  record(input: NewKeyRevocation): Promise<KeyRevocation>;
  /** Активный (ещё не закрытый recovery) отзыв пайщика либо null. */
  findActive(targetId: string): Promise<KeyRevocation | null>;
  /** Закрыть активные отзывы пайщика по завершении recovery (Эпик 3). */
  markRecovered(targetId: string): Promise<void>;
}
