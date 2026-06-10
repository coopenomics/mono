/**
 * Порт хранилища offline-кодов восстановления (CoopID, Story 3.4).
 *
 * Печатный 16-значный код, выданный пайщику при on-boarding, — альтернативный
 * первый канал recovery для тех, у кого нет доступа к email. Хранится keyed-hash
 * (HMAC-SHA256 на server_secret), сам код — нет. Lookup по точному хешу находит
 * владельца; код single-use (`consume` после выдачи recovery-токена).
 *
 * Bare-Symbol: домен не знает про БД (адаптер — infrastructure, как vault/2FA).
 */
export const OFFLINE_RECOVERY_CODE_REPOSITORY = Symbol('OfflineRecoveryCodeRepository');

export interface IOfflineRecoveryCodeRepository {
  /** Вернуть subject_id владельца кода по его keyed-hash, либо null. */
  findSubjectByCodeHash(codeHash: string): Promise<string | null>;
  /** Сохранить/перевыпустить keyed-hash кода для пайщика (сейм on-boarding). */
  set(subjectId: string, codeHash: string): Promise<void>;
  /** Удалить код пайщика (single-use после использования). */
  consume(subjectId: string): Promise<void>;
}
