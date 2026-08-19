/**
 * Порт настроек второго фактора ВХОДА (2FA-логин): какие подтверждения пайщик
 * включил для входа по паролю. Не путать с recovery-стратегией (Story 3.5) —
 * это независимая настройка контура входа.
 *
 * Отсутствие записи = ничего не включено (вход по паролю + доказательству ключа,
 * как раньше). Настройки — server-side состояние: клиент не может «попросить»
 * вход без факторов, гейт стоит в точке выпуска сессии (verify-timestamp).
 */

export const LOGIN_FACTORS_REPOSITORY = Symbol('LoginFactorsRepository');

export interface LoginFactorsRecord {
  subjectId: string;
  /** Требовать TOTP-код из приложения-аутентификатора при входе. */
  totpEnabled: boolean;
  /** Требовать одноразовый код, отправленный на подтверждённую почту. */
  emailEnabled: boolean;
}

export interface ILoginFactorsRepository {
  get(subjectId: string): Promise<LoginFactorsRecord | null>;
  set(record: LoginFactorsRecord): Promise<void>;
}
