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
   * Удалось ли хоть раз получить подписи пайщика с сервера. Пустой список —
   * это «пайщик ничего не подписал», и по нему интерфейс требует подписей;
   * неудачная выборка выглядит точно так же, поэтому её нельзя выдавать за
   * пустоту. Пока здесь false, о подписях достоверно не известно ничего.
   */
  agreementsLoaded: Ref<boolean>;
  /**
   * Подписано ли пайщиком главное соглашение цифрового кошелька. Пока оно не
   * подписано, кошелёк не активен — операции взноса и возврата недоступны
   * (так же скрыта карточка кошелька в столе пайщика).
   */
  isWalletAgreementSigned: Ref<boolean>;

  loadUserWallet: (params: ILoadUserWallet) => Promise<void>;
}

export const useWalletStore = defineStore(namespace, (): IWalletStore => {
  const deposits = ref<IDepositData[]>([]);
  const withdraws = ref<IWithdrawData[]>([]);
  const user_wallets = ref<IUserWalletData[]>([]);
  const _program_wallets_base = ref<ExtendedProgramWalletData[]>([]);
  const methods = ref<IPaymentMethodData[]>([]);
  const agreements = ref<IUserAgreement[]>([]);
  const agreementsLoaded = ref(false);


  const isWalletAgreementSigned = computed<boolean>(() =>
    agreements.value.some(
      (a) =>
        a.type === WALLET_AGREEMENT_TYPE &&
        a.status !== Zeus.AgreementStatus.DECLINED,
    ),
  );

  const program_wallets = computed<ExtendedProgramWalletData[]>(() => _program_wallets_base.value);


  // Запросы независимы (разные срезы кошелька/соглашений) — allSettled, а не
  // all: падение одного (напр. недостаточно прав на один из резолверов) не
  // должно обнулять остальные пять уже успешно загруженных.
  function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
    if (result.status === 'fulfilled') return result.value ?? fallback;
    console.error(result.reason);
    return fallback;
  }

  const loadUserWallet = async (params: ILoadUserWallet) => {
    // Имя пайщика обязательно: с пустым именем шесть запросов ниже уходят как
    // обращение к чужим данным и получают отказ вместо пустого ответа.
    if (!params.username || !params.coopname) return;

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
    /**
     * Подписи не проходят через unwrap: его запасное значение — пустой список,
     * а пустой список подписей интерфейс читает как «ничего не подписано» и
     * снова просит подписать уже подписанное. Упавшую выборку оставляем без
     * последствий: прежние данные достовернее пустоты, а если их ещё не было,
     * состояние так и останется «неизвестно» до успешной загрузки.
     */
    if (agreementsRes.status === 'fulfilled') {
      agreements.value = agreementsRes.value ?? [];
      agreementsLoaded.value = true;
    } else {
      console.error(agreementsRes.reason);
    }
    user_wallets.value = unwrap(userWalletsRes, []);
  };

  return {
    program_wallets: program_wallets as unknown as Ref<ExtendedProgramWalletData[]>,
    user_wallets,
    deposits,
    withdraws,
    methods,
    agreements,
    agreementsLoaded,
    isWalletAgreementSigned,
    loadUserWallet,
  };
});
