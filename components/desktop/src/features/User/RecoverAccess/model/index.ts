import { loginWithMagicLink, recover } from '@coopenomics/auth';
import { env } from 'src/shared/config';

export interface IConfirmRecoveryInput {
  /** Email пайщика — фактор-1 повторного входа через authentik после смены ключа. */
  email: string;
  /** Одноразовый токен из ссылки восстановления (`:coopname/auth/recover/:token`). */
  token: string;
  /** TOTP-код из приложения-аутентификатора — второй фактор подтверждения. */
  totp: string;
  /** Новый пароль: им шифруется новый vault и он же ставится в authentik. */
  newPassword: string;
}

/**
 * Восстановление доступа CoopID на десктопе (Эпик 12, Story 12.3).
 *
 * Контур magic-link: пайщик утратил ключ/пароль → запрашивает письмо по email →
 * по ссылке из письма подтверждает смену вторым фактором (TOTP) и задаёт новый
 * пароль. Клиент генерит новую пару, шифрует приватный ключ новым паролём и
 * отправляет публичный ключ + vault вместе с токеном; сервер ротирует active-ключ
 * on-chain, ставит пароль и возвращает account (см. SDK `loginWithMagicLink`).
 * Account заранее не нужен — он приходит в ответе confirm (whoami-by-token не нужен).
 */
export function useRecoverAccess() {
  /** Шаг 1: запросить magic-link на email. Бэкенд всегда отвечает 202 (анти-enumeration). */
  async function requestRecovery(email: string): Promise<void> {
    await recover(email);
  }

  /** Шаг 2: подтвердить восстановление (TOTP + новый пароль) и войти новым контуром. */
  async function confirmRecovery(input: IConfirmRecoveryInput): Promise<void> {
    await loginWithMagicLink({
      issuer: env.COOPID_ISSUER as string,
      email: input.email,
      token: input.token,
      totp: input.totp,
      newPassword: input.newPassword,
    });
  }

  return { requestRecovery, confirmRecovery };
}
