/**
 * Порт хранилища одноразовых recovery-токенов (CoopID, Story 3.1).
 *
 * Magic-link восстановления доступа несёт UUID-токен; по нему контроллер при
 * клике (Story 3.2) находит, КОМУ принадлежит запрос, и проводит смену пароля.
 * Токен живёт в Redis с коротким TTL (5 мин) и потребляется единожды
 * (`consume` = атомарный GETDEL) — повторный клик по той же ссылке невалиден.
 *
 * Bare-Symbol токен: домен не знает про Redis (ESLint-инвариант — ioredis только
 * в infrastructure). Адаптер — `infrastructure/auth-v2/redis-recovery-token.store.ts`
 * (ср. `RATE_LIMIT_STORAGE`, Story 9.1).
 */
export const RECOVERY_TOKEN_STORE = Symbol('RecoveryTokenStore');

/** Полезная нагрузка recovery-токена — кому и в каком кооперативе принадлежит запрос. */
export interface RecoveryTokenPayload {
  /** UUID пайщика (user.id) — `subject_id` для последующего audit/смены пароля. */
  subjectId: string;
  /** Имя аккаунта пайщика в кооперативе. */
  username: string;
  /** Кооператив-владелец запроса (federation-инвариант). */
  coopname: string;
}

export interface IRecoveryTokenStore {
  /** Положить токен с TTL (сек). Перезапись существующего ключа допустима. */
  issue(token: string, payload: RecoveryTokenPayload, ttlSec: number): Promise<void>;
  /**
   * Прочитать и сразу удалить токен (single-use). Возвращает payload либо null,
   * если токен не найден/истёк/уже потреблён. Используется в Story 3.2.
   */
  consume(token: string): Promise<RecoveryTokenPayload | null>;
}
