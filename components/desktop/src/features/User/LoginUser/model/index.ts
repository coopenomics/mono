import { useSessionStore } from 'src/entities/Session';
import { useGlobalStore } from 'src/shared/store';
import { api } from '../api';
import { client } from 'src/shared/api/client';
import { useRegistratorStore } from 'src/entities/Registrator';
import type { ITokens } from 'src/shared/lib/types/user';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import type { Zeus } from '@coopenomics/sdk';
import { configureTokenStorage, login as coopidLogin, migrate } from '@coopenomics/auth';
import { env } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';
import { createCoopIdStorage } from 'src/entities/Session/lib/coopidStorage';

export function useLoginUser() {
  const globalStore = useGlobalStore();
  const session = useSessionStore();
  const systemStore = useSystemStore();

  async function login(email: string, wif: string): Promise<void> {
    const result = await api.loginUser(email, wif);
    const { tokens, account } = result;

    session.setCurrentUserAccount(account);

    // Создаём объект tokens с правильными типами
    const adaptedTokens: ITokens = {
      access: {
        token: tokens.access.token,
        expires: new Date(tokens.access.expires as string),
      },
      refresh: {
        token: tokens.refresh.token,
        expires: new Date(tokens.refresh.expires as string),
      },
    };

    await globalStore.setWif(account.username, wif);
    await globalStore.setTokens(adaptedTokens);

    await session.init();
    client.setToken(tokens.access.token);

    const { run } = useInitWalletProcess();
    await run(); //запускаем фоновое обновление кошелька - заменить на подписку потом
    if (!session.isRegistrationComplete) {
      const { state, steps } = useRegistratorStore();
      state.userData.type = session?.privateAccount?.type as Zeus.AccountType;
      const privateData = session?.privateAccount;

      // Для каждого типа пользователя берём нужное поле и, если оно существует, переносим совпадающие ключи
      const dataMap = {
        individual: privateData?.individual_data,
        organization: privateData?.organization_data,
        entrepreneur: privateData?.entrepreneur_data,
      };

      const data = dataMap[state.userData.type];
      if (data) {
        Object.keys(data).forEach((key) => {
          if (key in state.userData) {
            (state.userData as any)[key] = (data as any)[key];
          }
        });
      }

      //continue registration process here
      state.account.username = session.username as string;
      state.account.private_key = wif;
      state.account.public_key = session.providerAccount
        ?.public_key as string;

      state.email = session.providerAccount?.email as string;

      // Статус берем из userAccount, не providerAccount
      const userStatus = session.userAccount?.status;
      if (userStatus === 'created') state.step = steps.ReadStatement;
      else if (userStatus === 'joined') state.step = steps.PayInitial;
      else if (userStatus === 'payed') state.step = steps.WaitingRegistration;
      else if (userStatus === 'registered') state.step = steps.Welcome;
    }
  }

  /**
   * Миграция действующего пайщика «ключ → пароль» (Эпик 11, Story 11.6),
   * логическая часть. Пайщик владеет только легаси-ключом (WIF) и ещё без пароля.
   *
   *  1. SDK `migrate()` (Story 11.4): доказывает владение ключом подписью против
   *     COOPOS, ставит пароль в authentik и шифрует ТОТ ЖЕ ключ паролём в
   *     server-vault. Приватный ключ на сервер не уходит — только шифр.
   *  2. Вход легаси-контуром тем же ключом (`login` выше) — сессия/keystore/токены
   *     устанавливаются существующим путём. Так пайщик переходит на пароль и СРАЗУ
   *     остаётся в системе, без потери доступа и без зависимости от готовности
   *     OIDC-инфраструктуры authentik (вход по паролю включится отдельно, Story 11.5).
   *
   * Идемпотентно (повтор с тем же ключом/паролём безопасен — см. SDK `migrate()`).
   * Бросает `AuthV2Error` (WeakPassword/InvalidCredentials/CooposDegraded/…) из
   * `migrate()` ДО легаси-входа — vault и пароль либо ставятся целиком, либо никак.
   */
  async function migrateAndLogin(params: {
    email: string;
    privateKey: string;
    newPassword: string;
  }): Promise<{ username: string }> {
    const result = await migrate({
      email: params.email,
      privateKey: params.privateKey,
      newPassword: params.newPassword,
    });
    await login(params.email, params.privateKey);
    return result;
  }

  /**
   * Вход по паролю CoopID (Story 11.5): фактор-1 — пароль через authentik,
   * фактор-2 — владение ключом (timestamp-handshake). Токены кладём в персистентное
   * хранилище (паритет с легаси — переживание reload), затем строим CoopID-сессию
   * поверх keystore (мост подписи Эпика 7).
   *
   * Деградация без инфры: вход по паролю опирается на OIDC-клиент authentik
   * (Эпик 5) — пока `COOPID_ISSUER` не задан, путь недоступен и пайщик входит по
   * ключу доступа (легаси не тронут). Полный фасад «authentik → unlock keystore →
   * handshake» довершается в SDK (#23) — здесь сторона desktop.
   */
  async function loginWithPassword(email: string, password: string): Promise<void> {
    if (!env.COOPID_ISSUER) {
      throw new Error(
        'Вход по паролю станет доступен после подключения авторизации кооператива. Пока войдите по ключу доступа.',
      );
    }
    const storage = createCoopIdStorage(systemStore.info.coopname);
    configureTokenStorage(storage);
    await coopidLogin({ issuer: env.COOPID_ISSUER, email, password });
    const ok = await session.establishCoopIdSession({ persistPin: true });
    if (!ok) {
      throw new Error('Не удалось установить сессию входа. Попробуйте ещё раз или войдите по ключу доступа.');
    }

    // Карточку пайщика и кошелёк грузим тем же процессом, что и обычный вход.
    // Отдельно запрашивать карточку не нужно — `run()` сам её берёт и кладёт в
    // стор; без этого шага приложение считало бы регистрацию незавершённой и
    // уводило на страницу регистрации (ответ authentik о пайщике ничего не знает).
    const { run } = useInitWalletProcess();
    await run();
  }

  return {
    login,
    migrateAndLogin,
    loginWithPassword,
  };
}
