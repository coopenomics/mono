import type { DegradedAuthReason } from '~/domain/auth-v2/degraded/degraded-auth.types';

/**
 * Порт хранилища challenge второго фактора входа (2FA-логин).
 *
 * Challenge создаётся ТОЛЬКО после того, как пайщик доказал пароль (authentik)
 * и владение ключом (verify-timestamp): он представляет «вход, ожидающий второго
 * подтверждения». Токен — непрозрачный секрет (256 бит), состояние живёт на
 * сервере: клиент не может ни подделать пройденные факторы, ни продлить окно.
 * Без завершения challenge платформенные токены не выпускаются вовсе.
 */

export const LOGIN_CHALLENGE_STORE = Symbol('LoginChallengeStore');

/** Виды факторов подтверждения входа. Порядок в `factors` = порядок прохождения. */
export enum LoginFactorKind {
  Totp = 'totp',
  Email = 'email',
}

export interface LoginChallengeState {
  /** user.id пайщика (subject аудита и выпуска токенов). */
  subjectId: string;
  /** username (sub из binding-токена) — для финализации и аудита. */
  sub: string;
  /** Очередь факторов в порядке прохождения (см. LoginFactorKind). */
  factors: LoginFactorKind[];
  /** Уже пройденные факторы (префикс `factors`). */
  passed: LoginFactorKind[];
  /** sha256-хэш действующего email-кода (hex); null — код ещё не отправлен. */
  emailCodeHash: string | null;
  /** Сколько раз код отправлялся на почту (лимит повторной отправки). */
  emailSendCount: number;
  /** Контекст входа для финализации (device tracking, метаданные сессии). */
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  /** Degraded-вход (сверка ключа по кэшу) — протаскивается в итоговый ответ. */
  degraded: boolean;
  degradedReason?: DegradedAuthReason;
}

export interface ILoginChallengeStore {
  /** Создать challenge; возвращает непрозрачный токен для клиента. */
  create(state: LoginChallengeState, ttlSec: number): Promise<string>;
  /** Прочитать состояние; null — токен неизвестен или истёк. */
  get(token: string): Promise<LoginChallengeState | null>;
  /** Перезаписать состояние, сохранив остаток TTL. */
  put(token: string, state: LoginChallengeState): Promise<void>;
  /** Сжечь challenge (успех, исчерпание попыток). */
  delete(token: string): Promise<void>;
  /**
   * Атомарно увеличить счётчик неверных попыток фактора; возвращает новое
   * значение. Живёт с тем же TTL, что и challenge.
   */
  bumpAttempts(token: string, factor: LoginFactorKind, ttlSec: number): Promise<number>;
  /**
   * Троттл повторной отправки email-кода: true — отправка разрешена (ключ
   * занят на `ttlSec`), false — ещё не прошло окно.
   */
  tryAcquireResend(token: string, ttlSec: number): Promise<boolean>;
}
