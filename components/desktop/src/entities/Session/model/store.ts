import { defineStore } from 'pinia';
import { useGlobalStore } from 'src/shared/store';
import { computed, ComputedRef, Ref, ref } from 'vue';
import { Session } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import {
  clearPinCache,
  configureTokenStorage,
  getWallet,
  isWalletUnlocked,
  lockWallet,
  persistPinCache,
  restoreSession,
  unlockWithPin,
} from '@coopenomics/auth';
import { FailAlert } from 'src/shared/api';
import { PrivateKey } from '@wharfkit/antelope';
import { env } from 'src/shared/config';
import type { IAccount } from 'src/entities/Account/types';
import { useDisplayName } from 'src/shared/lib/composables/useDisplayName';
import { useSystemStore } from 'src/entities/System/model';
import { WalletPluginCoopId } from '../lib/walletPluginCoopId';
import { createCoopIdStorage } from '../lib/coopidStorage';

interface ISessionStore {
  isAuth: Ref<boolean>;
  username: ComputedRef<string>;
  displayName: ComputedRef<string>;
  init: () => Promise<void>;
  //TODO add Blockchain Session here
  session: Ref<Session | undefined>;
  /**
   * Установить сессию контура CoopID (мост подписи, Эпик 7): построить wharfkit
   * Session с `WalletPluginCoopId` поверх keystore `@coopenomics/auth` (без WIF в
   * globalStore). Вызывается флоу входа CoopID после разблокировки keystore.
   * `persistPin` — записать локальный PIN-кэш (только при свежем входе, не на
   * reload). Возвращает `true`, если сессия установлена.
   */
  establishCoopIdSession: (opts?: { persistPin?: boolean }) => Promise<boolean>;
  close: () => Promise<void>;
  loadComplete: Ref<boolean>;
  // Добавляю данные текущего пользователя
  currentUserAccount: Ref<IAccount | undefined>;
  setCurrentUserAccount: (account: IAccount | undefined) => void;
  clearAccount: () => void;
  // Computed свойства для текущего пользователя
  isRegistrationComplete: ComputedRef<boolean>;
  // status === 'active' — пайщик принят советом, можно показывать дашборд.
  // Промежуточные статусы (created/joined/payed/registered) — публичная главная.
  isFullyActive: ComputedRef<boolean>;
  isChairman: ComputedRef<boolean>;
  isMember: ComputedRef<boolean>;
  // Удобные геттеры для различных типов данных
  userAccount: ComputedRef<IAccount['user_account'] | undefined>;
  privateAccount: ComputedRef<IAccount['private_account'] | undefined>;
  blockchainAccount: ComputedRef<IAccount['blockchain_account'] | undefined>;
  participantAccount: ComputedRef<IAccount['participant_account'] | undefined>;
  providerAccount: ComputedRef<IAccount['provider_account'] | undefined>;
  // Сводка по вступительному платежу — источник истины для восстановления шага
  // регистрации (ожидание/отклонение платежа) после перезагрузки и в любой вкладке.
  registrationPayment: ComputedRef<IAccount['registration_payment'] | undefined>;
}

export const useSessionStore = defineStore('session', (): ISessionStore => {
  const globalStore = useGlobalStore();
  const systemStore = useSystemStore();
  const isAuth = ref(false);
  const loadComplete = ref(false);
  const currentUserAccount = ref<IAccount | undefined>();

  const session = ref();

  // Аккаунт контура CoopID (когда сессия построена поверх keystore @coopenomics/auth,
  // а не легаси globalStore.wif). Источник fallback'а для username/isAuth.
  const coopIdAccount = ref('');

  // Авто-лок keystore по простою (уточнённая at-rest модель): RAM-ключ стирается
  // через AUTO_LOCK_MS, следующая подпись поднимет его из PIN-кэша (прозрачно при
  // дефолтном ПИН). Таймер скользящий — продлевается на каждой подписи (см.
  // ensureWalletUnlocked). Только для CoopID-контура; легаси globalStore не трогаем.
  const AUTO_LOCK_MS = 30 * 60 * 1000;
  let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

  const coopStorage = () => createCoopIdStorage(systemStore.info.coopname);

  const armAutoLock = () => {
    if (!coopIdAccount.value) return;
    if (autoLockTimer) clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(() => lockWallet(), AUTO_LOCK_MS);
  };

  /**
   * Гарантирует разблокированный keystore перед подписью CoopID (единственная
   * точка перехвата для всех session.transact — вызывается из WalletPluginCoopId).
   * Если заперт (после авто-лока/reload) — поднимает ключ из локального PIN-кэша.
   * Дефолтный ПИН делает это прозрачно; кастомный ПИН бросит VaultDecryptionFailed
   * (запрос ПИН — отдельная история на столе пайщика). Продлевает авто-лок.
   */
  const ensureWalletUnlocked = async (): Promise<void> => {
    if (!isWalletUnlocked()) {
      const wallet = await unlockWithPin({ storage: coopStorage() });
      if (!wallet)
        throw new Error('CoopID keystore заперт: войдите заново (нет локального ключа)');
    }
    armAutoLock();
  };

  const establishCoopIdSession = async (opts?: {
    persistPin?: boolean;
  }): Promise<boolean> => {
    const storage = coopStorage();
    // На reload keystore заперт — поднимаем из PIN-кэша (дефолт прозрачно). Если
    // кэша нет (на этом устройстве не входили) — CoopID-сессии нет, выходим.
    if (!isWalletUnlocked()) {
      const restored = await unlockWithPin({ storage }).catch(() => null);
      if (!restored) return false;
    }
    // PIN-кэш пишем ТОЛЬКО при свежем входе: на reload перешифровка дефолтным ПИН
    // затёрла бы кастомный ПИН пользователя.
    if (opts?.persistPin) await persistPinCache({ storage }).catch(() => undefined);

    const wallet = await getWallet();
    session.value = new Session({
      actor: wallet.account,
      permission: 'active',
      chain: {
        id: env.CHAIN_ID as string,
        url: env.CHAIN_URL as string,
      },
      walletPlugin: new WalletPluginCoopId({
        publicKey: wallet.publicKey,
        ensureUnlocked: ensureWalletUnlocked,
      }),
    });
    coopIdAccount.value = wallet.account;
    isAuth.value = true;
    armAutoLock();
    return true;
  };

  const setCurrentUserAccount = (account: IAccount | undefined) => {
    currentUserAccount.value = account;
  };

  const clearAccount = () => {
    setCurrentUserAccount(undefined);
  };

  const close = async (): Promise<void> => {
    isAuth.value = false;
    session.value = undefined;
    currentUserAccount.value = undefined;
    if (autoLockTimer) clearTimeout(autoLockTimer);
    // CoopID-контур: затереть RAM-ключ и локальный PIN-кэш («забыть устройство»).
    if (coopIdAccount.value) {
      lockWallet();
      await clearPinCache(coopStorage()).catch(() => undefined);
      coopIdAccount.value = '';
    }
    globalStore.logout();
  };

  const init = async () => {
    if (!globalStore.hasCreditials) {
      await globalStore.init();
      isAuth.value = globalStore.hasCreditials;

      try {
        if (globalStore.hasCreditials) {
          session.value = new Session({
            actor: globalStore.username,
            permission: 'active',
            chain: {
              id: env.CHAIN_ID as string,
              url: env.CHAIN_URL as string,
            },
            walletPlugin: new WalletPluginPrivateKey(
              globalStore.wif as PrivateKey,
            ),
          });
          return;
        }
      } catch (e: any) {
        console.error(e);
        FailAlert(e);
        close();
        globalStore.logout();
        return;
      }

      // Легаси-ключа нет — пробуем контур CoopID: токены восстанавливаем из
      // персистентного хранилища (паритет с легаси — переживание F5), ключ
      // поднимаем из локального PIN-кэша (мост подписи, Эпик 7). Полностью
      // аддитивно: если CoopID-артефактов нет, ветка — no-op, легаси не задет.
      try {
        configureTokenStorage(coopStorage());
        await restoreSession();
        await establishCoopIdSession();
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  // Компьютед для проверки завершения регистрации пользователя
  const isRegistrationComplete = computed(() =>
    Boolean(
      currentUserAccount.value && currentUserAccount.value.participant_account,
    ),
  );

  // Пайщик принят советом (status === 'active' из users в моно).
  // Используется как порог для dashboard/wallet/документов. На промежуточных
  // статусах (created/joined/payed/registered) показываем публичную главную —
  // не редиректим, не дёргаем кошелёк, не открываем подписи оферт.
  const isFullyActive = computed(
    () => currentUserAccount.value?.user_account?.status === 'active',
  );

  const isChairman = computed(() => {
    const chairman = currentUserAccount.value?.provider_account?.role === 'chairman';
    return chairman;
  });

  const isMember = computed(() => {
    const member = currentUserAccount.value?.provider_account?.role === 'member';
    return member;
  });

  // Удобные геттеры для различных типов данных
  const userAccount = computed(() => currentUserAccount.value?.user_account);
  const privateAccount = computed(() => currentUserAccount.value?.private_account);
  const blockchainAccount = computed(
    () => currentUserAccount.value?.blockchain_account,
  );
  const participantAccount = computed(
    () => currentUserAccount.value?.participant_account,
  );
  const providerAccount = computed(
    () => currentUserAccount.value?.provider_account,
  );
  const registrationPayment = computed(
    () => currentUserAccount.value?.registration_payment,
  );

  // username легаси-контура; для CoopID-сессии globalStore пуст — fallback на аккаунт keystore.
  const username = computed(() => globalStore.username || coopIdAccount.value);

  // Display name пользователя (ФИО или название организации)
  const displayName = computed(() => {
    const userProfile = privateAccount.value?.individual_data ||
                       privateAccount.value?.organization_data ||
                       privateAccount.value?.entrepreneur_data ||
                       null;

    const { displayName: computedDisplayName } = useDisplayName(userProfile);
    return computedDisplayName.value;
  });

  return {
    isAuth,
    init,
    session,
    establishCoopIdSession,
    username,
    displayName,
    close,
    loadComplete,
    currentUserAccount,
    setCurrentUserAccount,
    clearAccount,
    isRegistrationComplete,
    isFullyActive,
    isChairman,
    isMember,
    // Удобные геттеры для различных типов данных
    userAccount,
    privateAccount,
    blockchainAccount,
    participantAccount,
    providerAccount,
    registrationPayment,
  };
});
