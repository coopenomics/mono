export const EMAIL_VERIFICATION_STORE = Symbol('EmailVerificationStore');

/** Состояние выданного кода подтверждения адреса. */
export interface EmailVerificationState {
  /** Нормализованный адрес (ключ хранится хэшем, сам адрес нужен для письма и логов). */
  email: string;
  /** sha256-хэш действующего кода (hex). Сам код не хранится нигде. */
  codeHash: string;
  /** Сколько раз код отправлялся на этот адрес в текущем окне. */
  sendCount: number;
}

/**
 * Порт хранилища кодов подтверждения электронной почты.
 *
 * Ключ — АДРЕС, а не пайщик: подтверждение требуется на первом шаге регистрации,
 * когда учётной записи ещё нет (она создаётся сильно позже, на шаге генерации
 * аккаунта). Тот же механизм обслуживает подтверждение из кабинета — там адрес
 * просто берётся из аккаунта.
 *
 * Отметка о состоявшемся подтверждении (`markVerified`/`isVerified`) живёт
 * отдельно и дольше кода: между вводом кода на первом шаге и созданием аккаунта
 * пайщик проходит анкету, выбор программы, подписание — это не минуты.
 */
export interface IEmailVerificationStore {
  /** Записать выданный код (перетирает предыдущий), окно жизни — `ttlSec`. */
  put(email: string, state: EmailVerificationState, ttlSec: number): Promise<void>;
  /** Прочитать состояние; null — код не выдавался или окно истекло. */
  get(email: string): Promise<EmailVerificationState | null>;
  /** Сжечь код (успешное подтверждение, исчерпание попыток). */
  delete(email: string): Promise<void>;
  /**
   * Атомарно увеличить счётчик неверных попыток; возвращает новое значение.
   * Живёт с тем же окном, что и код.
   */
  bumpAttempts(email: string, ttlSec: number): Promise<number>;
  /**
   * Троттл повторной отправки: true — отправка разрешена (окно занято на
   * `ttlSec`), false — ещё рано.
   */
  tryAcquireResend(email: string, ttlSec: number): Promise<boolean>;
  /** Сколько секунд осталось до конца троттла повторной отправки (0 — можно слать). */
  resendCooldown(email: string): Promise<number>;
  /** Отметить адрес подтверждённым на `ttlSec` (для последующего создания аккаунта). */
  markVerified(email: string, ttlSec: number): Promise<void>;
  /** Подтверждён ли адрес в текущем окне. */
  isVerified(email: string): Promise<boolean>;
  /**
   * Счётчик обращений с одного адреса (IP или почтовый) за окно — защита от
   * рассылки писем чужим людям через открытую мутацию регистрации.
   */
  bumpRequests(scope: string, key: string, ttlSec: number): Promise<number>;
}
