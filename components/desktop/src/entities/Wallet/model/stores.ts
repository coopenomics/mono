import { defineStore } from 'pinia';
import { Zeus } from '@coopenomics/sdk';
import { api } from '../api';
import {
  IDepositData,
  IWithdrawData,
  ExtendedProgramWalletData,
  IUserWalletData,
  IPaymentMethodData,
  IUserAgreement,
} from './types';
import { ILoadUserWallet } from './types';
import { computed, Ref, ref } from 'vue';
import {
  applyAssetDelta,
  generatePatchId,
  matchesEntry,
  type IWalletPatch,
  type IWalletPatchEntry,
} from './optimistic';

const namespace = 'wallet';

// Тип главного соглашения цифрового кошелька в списке соглашений пайщика
// (канон agreementsBase = ['wallet', 'signature', 'privacy', 'user']).
const WALLET_AGREEMENT_TYPE = 'wallet';

interface IWalletStore {
  /*  доменный интерфейс кошелька пользователя */
  program_wallets: Ref<ExtendedProgramWalletData[]>;
  /**
   * Сырые кошельки пайщика «как есть» (по `wallet_name`, без сворачивания
   * паевого и членского) — источник реестра карточек кошельков на столе
   * пайщика. В отличие от `program_wallets` (срез по программе), даёт каждый
   * кошелёк отдельной строкой.
   */
  user_wallets: Ref<IUserWalletData[]>;
  deposits: Ref<IDepositData[]>;
  withdraws: Ref<IWithdrawData[]>;
  methods: Ref<IPaymentMethodData[]>;
  agreements: Ref<IUserAgreement[]>;
  /**
   * Подписано ли пайщиком главное соглашение цифрового кошелька. Пока оно не
   * подписано, кошелёк не активен — операции взноса и возврата недоступны
   * (так же скрыта карточка кошелька в столе пайщика).
   */
  isWalletAgreementSigned: Ref<boolean>;

  loadUserWallet: (params: ILoadUserWallet) => Promise<void>;

  /**
   * Универсальный optimistic-update для program_wallets. Любая фича, которая
   * двигает деньги между кошельками, может вызвать это перед/после своей
   * мутации — UI отразит изменение моментально, до того как дельта реально
   * прилетит из блокчейна и сервера.
   *
   * Возвращает id патча — его можно ревертить вручную (если мутация упала)
   * или дождаться авто-снятия по TTL / следующего loadUserWallet.
   */
  applyOptimisticPatch: (entries: IWalletPatchEntry[], ttlMs?: number) => string;
  revertOptimisticPatch: (patchId: string) => void;
  clearOptimisticPatches: () => void;
}

const DEFAULT_OPTIMISTIC_TTL_MS = 8000;

export const useWalletStore = defineStore(namespace, (): IWalletStore => {
  const deposits = ref<IDepositData[]>([]);
  const withdraws = ref<IWithdrawData[]>([]);
  const user_wallets = ref<IUserWalletData[]>([]);
  const _program_wallets_base = ref<ExtendedProgramWalletData[]>([]);
  const methods = ref<IPaymentMethodData[]>([]);
  const agreements = ref<IUserAgreement[]>([]);
  const _patches = ref<IWalletPatch[]>([]);

  const isWalletAgreementSigned = computed<boolean>(() =>
    agreements.value.some(
      (a) =>
        a.type === WALLET_AGREEMENT_TYPE &&
        a.status !== Zeus.AgreementStatus.DECLINED,
    ),
  );

  const program_wallets = computed<ExtendedProgramWalletData[]>(() => {
    if (_patches.value.length === 0) return _program_wallets_base.value;
    const overlay = _program_wallets_base.value.map((w) => ({ ...w }));
    for (const patch of _patches.value) {
      for (const entry of patch.entries) {
        for (const item of overlay) {
          if (!matchesEntry(item, entry)) continue;
          if (entry.available_delta) {
            item.available = applyAssetDelta(item.available ?? '0.0000 RUB', entry.available_delta);
          }
        }
      }
    }
    return overlay;
  });

  const applyOptimisticPatch = (
    entries: IWalletPatchEntry[],
    ttlMs: number = DEFAULT_OPTIMISTIC_TTL_MS,
  ): string => {
    const id = generatePatchId();
    const patch: IWalletPatch = {
      id,
      entries,
      appliedAt: Date.now(),
      ttlMs,
    };
    _patches.value = [..._patches.value, patch];
    if (ttlMs > 0) {
      setTimeout(() => revertOptimisticPatch(id), ttlMs);
    }
    return id;
  };

  const revertOptimisticPatch = (patchId: string): void => {
    _patches.value = _patches.value.filter((p) => p.id !== patchId);
  };

  const clearOptimisticPatches = (): void => {
    _patches.value = [];
  };

  // Запросы независимы (разные срезы кошелька/соглашений) — allSettled, а не
  // all: падение одного (напр. недостаточно прав на один из резолверов) не
  // должно обнулять остальные пять уже успешно загруженных.
  function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') return result.value ?? fallback;
    console.error(result.reason);
    return fallback;
  }

  const loadUserWallet = async (params: ILoadUserWallet) => {
    const [depositsRes, withdrawsRes, programWalletsRes, methodsRes, agreementsRes, userWalletsRes] =
      await Promise.allSettled([
        api.loadUserDepositsData(params),
        api.loadUserWithdrawsData(params),
        api.loadUserProgramWalletsData(params),
        api.loadMethods(params),
        api.loadUserAgreements(params.coopname, params.username),
        api.loadUserWalletsData(params),
      ]);

    deposits.value = unwrap(depositsRes, []);
    withdraws.value = unwrap(withdrawsRes, []);
    _program_wallets_base.value = unwrap(programWalletsRes, []);
    methods.value = unwrap(methodsRes, []);
    agreements.value = unwrap(agreementsRes, []);
    user_wallets.value = unwrap(userWalletsRes, []);
    // Серверная правда выигрывает — все наложенные оптимистичные патчи
    // сбрасываются. Если расхождение есть, оно будет видно сразу (а не
    // как «откат через TTL» через несколько секунд).
    clearOptimisticPatches();
  };

  return {
    program_wallets: program_wallets as unknown as Ref<ExtendedProgramWalletData[]>,
    user_wallets,
    deposits,
    withdraws,
    methods,
    agreements,
    isWalletAgreementSigned,
    loadUserWallet,
    applyOptimisticPatch,
    revertOptimisticPatch,
    clearOptimisticPatches,
  };
});
