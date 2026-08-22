import { defineStore } from 'pinia';
import { useGlobalStore } from 'src/shared/store';
import { computed, ComputedRef, Ref, ref } from 'vue';
import { Session } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import {
  clearPinCache,
  clearSession,
  configureTokenStorage,
  getWallet,
  isWalletUnlocked,
  exportUnlockedKeyForDocumentSigning,
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
  /** Сессия построена поверх keystore CoopID (тогда применимо PIN-самообслуживание). */
  isCoopIdSession: ComputedRef<boolean>;
  /** Включён ли кастомный PIN (иначе дефолтный прозрачный `000000`). */
  hasCustomPin: Ref<boolean>;
  /** Открыт ли запрос PIN перед подписью (после авто-лока). */
  pinPrompt: Ref<boolean>;
  /** Активен ли блокирующий PIN-гейт после перезагрузки. */
  pinUnlockPending: Ref<boolean>;
  /** Текст ошибки последнего ввода PIN. */
  pinError: Ref<string>;
  /** Установить или сменить кастомный PIN. */
  setCustomPin: (pin: string) => Promise<void>;
  /** Снять кастомный PIN (вернуть прозрачный дефолт). */
  removeCustomPin: () => Promise<void>;
  /** Подтвердить введённый PIN для подписи. */
  submitSignPin: (pin: string) => void;
  /** Отменить ввод PIN (подпись/разблокировка не состоится). */
  cancelPin: () => void;
  /** Разблокировать keystore по PIN после reload (для PIN-гейта). */
  completePinUnlock: (pin: string) => Promise<boolean>;
  /** Заперт ли keystore CoopID: ключа в памяти нет, подпись потребует PIN. */
  walletLocked: Ref<boolean>;
  /** Запереть keystore немедленно, не дожидаясь простоя. */
  lockWalletNow: () => void;
  /** Отпереть keystore, спросив PIN, если он установлен. `false` — отказались. */
  unlockWalletInteractive: () => Promise<boolean>;
  /** Верен ли PIN-код. Нужно там, где PIN подтверждает право менять сам PIN. */
  verifyPin: (pin: string) => Promise<boolean>;
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

  // PIN-кэш ключа (уточнённая модель Эпика 7): пароль/ключ — реальная at-rest
  // защита; PIN — необязательный барьер «от постороннего» поверх уже
  // разблокированного устройства. Дефолт `000000` прозрачен (авто-unlock без
  // спроса); кастомный PIN спрашивается при подписи после авто-лока (30 мин) и на
  // reload. Маркер «кастомный PIN включён» лежит рядом с кэшем (cache-запись есть
  // всегда после входа, поэтому отдельный флаг кастомности).
  const PIN_MARKER_KEY = 'coopid.wallet.pin-custom';
  const hasCustomPin = ref(false);
  const isCoopIdSession = computed(() => !!coopIdAccount.value);
  // Запрос PIN у пользователя. 'sign' — перед подписью после авто-лока
  // (промис-ориентированный, приложение уже смонтировано); pinUnlockPending —
  // блокирующий гейт на reload (до загрузки кабинета). pinError — текст ошибки.
  const pinPrompt = ref(false);
  const pinUnlockPending = ref(false);
  const pinError = ref('');
  // Заперт ли keystore — то же, что `isWalletUnlocked()`, но в виде состояния, за
  // которым может следить интерфейс. Функция пакета отвечает на вопрос в момент
  // вызова и о том, что ключ стёрся по простою, никого не уведомляет.
  const walletLocked = ref(true);
  let pinResolver: ((pin: string | null) => void) | null = null;

  const loadPinMarker = async (): Promise<void> => {
    hasCustomPin.value = (await coopStorage().get(PIN_MARKER_KEY).catch(() => null)) === '1';
  };

  /** Запросить у пользователя PIN перед подписью (промис ждёт submit/cancel из PinPrompt). */
  const requestPin = (): Promise<string | null> => {
    pinError.value = '';
    pinPrompt.value = true;
    return new Promise((resolve) => {
      pinResolver = resolve;
    });
  };

  /** Пользователь ввёл PIN в диалоге подписи. */
  const submitSignPin = (pin: string): void => {
    pinPrompt.value = false;
    pinResolver?.(pin);
    pinResolver = null;
  };

  /** Пользователь отменил ввод PIN (подпись не состоится). */
  const cancelPin = (): void => {
    pinPrompt.value = false;
    pinResolver?.(null);
    pinResolver = null;
  };

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
    autoLockTimer = setTimeout(() => {
      lockWalletNow();
    }, AUTO_LOCK_MS);
  };

  /**
   * Запереть keystore сразу: ключ уходит из памяти целиком — и из хранилища
   * контура, и из общего стора, куда он выдан для подписи документов.
   *
   * Тем же путём срабатывает и простой, поэтому «заперлось само» и «заперли
   * руками» неотличимы: одно состояние и один способ вернуться — ввести PIN.
   */
  const lockWalletNow = (): void => {
    if (autoLockTimer) {
      clearTimeout(autoLockTimer);
      autoLockTimer = null;
    }
    lockWallet();
    globalStore.clearSessionKey();
    walletLocked.value = true;
  };

  /**
   * Отпереть keystore по требованию пайщика — тем же путём, что и подпись: при
   * установленном PIN спросит его, при дефолтном отопрёт молча. Отказ от ввода
   * возвращает `false`, а не бросает: это не сбой, а передумали.
   */
  const unlockWalletInteractive = async (): Promise<boolean> => {
    try {
      await ensureWalletUnlocked();
      return true;
    }
    catch {
      return false;
    }
  };

  /**
   * Выдаёт ключ разблокированной сессии в общий стор — оттуда его берёт подпись
   * документов кооператива (повестка совета, заявления, акты). В памяти, без записи
   * в браузерное хранилище.
   *
   * Нужно потому, что подпись документов собирается классом SDK, принимающим ключ
   * строкой, тогда как подпись транзакций уже ходит через мост и ключа не видит.
   * Пока класс не научится подписывать чужими руками, вход по паролю без этой выдачи
   * оставляет пайщика без единой доступной подписи.
   */
  const publishSessionKey = async (): Promise<void> => {
    if (!isWalletUnlocked()) return;
    const wallet = await getWallet();
    globalStore.useSessionKey(wallet.account, exportUnlockedKeyForDocumentSigning());
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
      const storage = coopStorage();
      if (hasCustomPin.value) {
        // Кастомный PIN: спрашиваем у пользователя (повторяем до верного или отмены).
        let wallet: Awaited<ReturnType<typeof unlockWithPin>> | null = null;
        while (!wallet) {
          const pin = await requestPin();
          if (pin === null)
            throw new Error('Для подписи нужен PIN-код');
          wallet = await unlockWithPin({ pin, storage }).catch(() => null);
          if (!wallet) pinError.value = 'Неверный PIN-код';
        }
        pinError.value = '';
      } else {
        // Дефолтный PIN — прозрачная разблокировка без спроса.
        const wallet = await unlockWithPin({ storage });
        if (!wallet)
          throw new Error('CoopID keystore заперт: войдите заново (нет локального ключа)');
      }
    }
    // После любой разблокировки ключ снова доступен подписи документов.
    await publishSessionKey();
    walletLocked.value = false;
    armAutoLock();
  };

  // Подпись документов берёт ключ из общего стора и о запертом кошельке не знает.
  // Отдаём туда отпирание: заперто — спросит PIN, а не уронит подпись.
  globalStore.setUnlockProvider(() => ensureWalletUnlocked());

  /**
   * Верен ли PIN-код.
   *
   * Проверка и есть разблокировка: локальный кэш ключа зашифрован самим PIN-ом,
   * и единственный способ убедиться в верности — попробовать им расшифровать.
   * Отдельного «пароля от PIN-кода» в этой модели нет и быть не может.
   */
  const verifyPin = async (pin: string): Promise<boolean> => {
    const wallet = await unlockWithPin({ pin, storage: coopStorage() }).catch(() => null);
    if (!wallet) return false;
    await publishSessionKey();
    walletLocked.value = false;
    armAutoLock();
    return true;
  };

  /** Установить/сменить кастомный PIN: перешифровать RAM-ключ под новым PIN + маркер. */
  const setCustomPin = async (pin: string): Promise<void> => {
    await ensureWalletUnlocked();
    const storage = coopStorage();
    await persistPinCache({ pin, storage });
    await storage.set(PIN_MARKER_KEY, '1');
    hasCustomPin.value = true;
  };

  /** Снять кастомный PIN: вернуть прозрачный дефолтный PIN + убрать маркер. */
  const removeCustomPin = async (): Promise<void> => {
    await ensureWalletUnlocked();
    const storage = coopStorage();
    await persistPinCache({ storage });
    await storage.remove(PIN_MARKER_KEY).catch(() => undefined);
    hasCustomPin.value = false;
  };

  /**
   * Завершить reload-гейт: разблокировать keystore введённым PIN. На успехе
   * снимает pinUnlockPending; загрузку кабинета доводит вызывающий
   * (PinPrompt → useInitWalletProcess().run), чтобы не плодить циклический импорт.
   */
  const completePinUnlock = async (pin: string): Promise<boolean> => {
    const wallet = await unlockWithPin({ pin, storage: coopStorage() }).catch(() => null);
    if (!wallet) {
      pinError.value = 'Неверный PIN-код';
      return false;
    }
    pinError.value = '';
    pinUnlockPending.value = false;
    await publishSessionKey();
    return true;
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
    //
    // Намеренно БЕЗ await: кэш нужен следующей загрузке страницы, а не этой, и
    // держать вход из-за него незачем — это ещё одна деривация Argon2id поверх
    // той, что уже отработала на расшифровке серверного vault'а. Ошибку глотаем:
    // нет кэша — следующий вход просто спросит пароль.
    if (opts?.persistPin) void persistPinCache({ storage }).catch(() => undefined);

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
    // Документы кооператива подписываются ключом из общего стора — выдаём его туда,
    // иначе вход по паролю не даёт подписать ничего.
    await publishSessionKey();
    walletLocked.value = false;
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

    // «Забыть устройство» целиком: ключ из памяти, PIN-кэш, маркер и токены.
    //
    // Чистим безусловно, а не только при построенной сессии. На PIN-гейте после
    // перезагрузки сессии ещё нет — есть только токены и запертый keystore, — и
    // при прежнем условии «Войти заново» не стирал ничего: следующая загрузка
    // упиралась в тот же гейт, а под ним лежала форма входа, до которой было не
    // добраться. Выйти из кабинета становилось нельзя вовсе.
    //
    // Токены затираем тоже: с ними одними гейт поднимется снова, даже без ключа.
    lockWallet();
    const storage = coopStorage();
    await clearPinCache(storage).catch(() => undefined);
    await storage.remove(PIN_MARKER_KEY).catch(() => undefined);
    clearSession();
    coopIdAccount.value = '';
    walletLocked.value = true;
    hasCustomPin.value = false;
    pinUnlockPending.value = false;
    pinPrompt.value = false;
    pinError.value = '';
    globalStore.logout();
  };

  const init = async () => {
    // Сессия CoopID уже установлена — восстанавливать нечего, и трогать её нельзя.
    // Ниже идёт ветка легаси-контура: она первым делом присваивает `isAuth`
    // результат проверки легаси-ключа, а у входа по паролю такого ключа нет — и
    // живая сессия на мгновение становилась неавторизованной. Кабинет на это
    // мгновение разбирался и собирался заново: весь набор запросов кабинета
    // уходил на сервер дважды подряд, вход растягивался на лишние секунды.
    if (isAuth.value && coopIdAccount.value) return;

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
        const hasTokens = await restoreSession();
        await loadPinMarker();
        if (hasTokens && hasCustomPin.value && !isWalletUnlocked()) {
          // Кастомный PIN: keystore заперт после reload — поднимаем блокирующий
          // PIN-гейт. PinPrompt разблокирует ключ и до-инициализирует кабинет.
          pinUnlockPending.value = true;
        } else {
          await establishCoopIdSession();
        }
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
    isCoopIdSession,
    hasCustomPin,
    pinPrompt,
    pinUnlockPending,
    pinError,
    setCustomPin,
    removeCustomPin,
    submitSignPin,
    cancelPin,
    completePinUnlock,
    walletLocked,
    lockWalletNow,
    unlockWalletInteractive,
    verifyPin,
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
