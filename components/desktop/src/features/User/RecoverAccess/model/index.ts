import { configureTokenStorage, loginWithMagicLink, recover, recoveryContext } from '@coopenomics/auth';
import type { RecoveryContext } from '@coopenomics/auth';
import { env } from 'src/shared/config';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { createCoopIdStorage } from 'src/entities/Session/lib/coopidStorage';

export interface IConfirmRecoveryInput {
  /** Email пайщика — фактор-1 повторного входа через authentik после смены ключа. */
  email: string;
  /** Одноразовый токен из ссылки восстановления (`:coopname/auth/recover/:token`). */
  token: string;
  /** TOTP-код из приложения-аутентификатора. Пусто, если пайщик 2FA не подключал. */
  totp?: string;
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
  const session = useSessionStore();
  const systemStore = useSystemStore();

  /** Шаг 1: запросить magic-link на email. Бэкенд всегда отвечает 202 (анти-enumeration). */
  async function requestRecovery(email: string): Promise<void> {
    await recover(email);
  }

  /**
   * Шаг 1.5: чем собирать форму подтверждения. Почту сервер знает по токену — спрашивать
   * её у пайщика незачем, а код просим только у того, кто 2FA подключал (владелец 03.09.2026).
   */
  async function loadRecoveryContext(token: string): Promise<RecoveryContext> {
    return recoveryContext(token);
  }

  /**
   * Шаг 2: подтвердить восстановление (TOTP + новый пароль) и войти новым контуром
   * через МОСТ ПОДПИСИ CoopID (Эпик 7). У восстановленного пайщика легаси-WIF нет —
   * ключ живёт в keystore @coopenomics/auth, поэтому сессия строится поверх него
   * (`establishCoopIdSession`), а не из `globalStore.wif`.
   */
  async function confirmRecovery(input: IConfirmRecoveryInput): Promise<void> {
    const storage = createCoopIdStorage(systemStore.info.coopname);
    // Подключаем персистентность токенов ДО входа — чтобы выданная пара легла в
    // IndexedDB и сессия пережила перезагрузку (паритет с легаси).
    configureTokenStorage(storage);

    await loginWithMagicLink({
      issuer: env.COOPID_ISSUER as string,
      email: input.email,
      token: input.token,
      totp: input.totp,
      newPassword: input.newPassword,
      storage,
    });

    // Строим wharfkit-сессию поверх keystore + пишем локальный PIN-кэш (дефолт
    // прозрачный) — дальше подпись он-чейн идёт через WalletPluginCoopId.
    await session.establishCoopIdSession({ persistPin: true });
  }

  return { requestRecovery, loadRecoveryContext, confirmRecovery };
}
