import { defineStore } from 'pinia';
import { Zeus } from '@coopenomics/sdk';
import { api } from '../api';
import {
  IDepositData,
  IWithdrawData,
  ExtendedProgramWalletData,
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

  const loadUserWallet = async (params: ILoadUserWallet) => {
    try {
      const data = await Promise.all([
        api.loadUserDepositsData(params),
        api.loadUserWithdrawsData(params),
        api.loadUserProgramWalletsData(params),
        api.loadMethods(params),
        api.loadUserAgreements(params.coopname, params.username),
      ]);

      deposits.value = data[0] ?? [];
      withdraws.value = data[1] ?? [];
      _program_wallets_base.value = data[2] ?? [];
      methods.value = data[3] ?? [];
      agreements.value = data[4] ?? [];
      // Серверная правда выигрывает — все наложенные оптимистичные патчи
      // сбрасываются. Если расхождение есть, оно будет видно сразу (а не
      // как «откат через TTL» через несколько секунд).
      clearOptimisticPatches();
    } catch (e: any) {
      console.log(e);
    }
  };

  return {
    program_wallets: program_wallets as unknown as Ref<ExtendedProgramWalletData[]>,
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
