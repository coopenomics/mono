import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { IGeneratedAccount } from 'src/shared/lib/types/user';
import { type IUserData } from 'src/shared/lib/types/user/IUserData';
import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import type { IDocument, ISignatureInfo } from 'src/shared/lib/types/document';
import { Zeus, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IInitialPaymentOrder } from 'src/shared/lib/types/payments';

// Программа участия в регистрации — тип берётся напрямую из SDK-выдачи
// getRegistrationConfig, не переописывается.
type IRegistrationProgram =
  Queries.System.GetRegistrationConfig.IOutput['getRegistrationConfig']['programs'][number];

const namespace = 'registrator';

// Начальное состояние для account
const initialAccountState: IGeneratedAccount = {
  username: '',
  private_key: '',
  public_key: '',
};

/**
 * Форма ведёт все три анкеты сразу: переключение типа субъекта не должно
 * стирать уже введённое, поэтому в состоянии блоки заданы всегда. В самом
 * `IUserData` они опциональны — там это вход мутаций, где приезжает ровно
 * один блок. Отсюда отдельный тип состояния: без него присвоение полей
 * анкеты не проходит проверку типов, ведь блок формально может отсутствовать.
 */
type IUserDataState = IUserData &
  Required<Pick<IUserData, 'entrepreneur_data' | 'individual_data' | 'organization_data'>>;

// Начальное состояние для userData
const initialUserDataState: IUserDataState = {
  type: null,
  individual_data: {
    first_name: '',
    last_name: '',
    middle_name: '',
    birthdate: '',
    full_address: '',
    phone: '',
  },
  organization_data: {
    type: Zeus.OrganizationType.COOP,
    short_name: '',
    full_name: '',
    represented_by: {
      first_name: '',
      last_name: '',
      middle_name: '',
      position: '',
      based_on: '',
    },
    country: 'Russia',
    city: '',
    full_address: '',
    fact_address: '',
    phone: '',
    details: {
      kpp: '',
      inn: '',
      ogrn: '',
    },
    bank_account: {
      currency: 'RUB',
      card_number: undefined,
      bank_name: '',
      account_number: '',
      details: {
        bik: '',
        corr: '',
      },
    },
  },
  entrepreneur_data: {
    first_name: '',
    last_name: '',
    middle_name: '',
    birthdate: '',
    phone: '',
    country: Zeus.Country.Russia,
    city: '',
    full_address: '',
    details: {
      inn: '',
      ogrn: '',
    },
    bank_account: {
      currency: 'RUB',
      card_number: undefined,
      bank_name: '',
      account_number: '',
      details: {
        bik: '',
        corr: '',
      },
    },
  },
};

// Начальное состояние для любого документа
const initialDocumentState: IDocument = {
  hash: '',
  meta: {} as Cooperative.Document.IMetaDocument,
  meta_hash: '',
  version: '',
  doc_hash: '',
  signatures: [] as ISignatureInfo[],
};

// Начальное состояние для payment
const initialPaymentState: IInitialPaymentOrder | null = null;

// Начальное состояние для agreements
const initialAgreementsState = {
  condidential: false,
  digital_signature: false,
  wallet: false,
  ustav: false,
  user: false,
  self_paid: false,
};
export const useRegistratorStore = defineStore(
  namespace,
  () => {
    const state = reactive({
      step: 1,
      role: 'user',
      email: '',
      selectedBranch: '',
      selectedProgramKey: '',
      account: structuredClone(initialAccountState),
      userData: structuredClone(initialUserDataState),
      signature: '',
      inLoading: false,
      agreements: structuredClone(initialAgreementsState),
      statement: structuredClone(initialDocumentState),
      walletAgreement: structuredClone(initialDocumentState),
      privacyAgreement: structuredClone(initialDocumentState),
      signatureAgreement: structuredClone(initialDocumentState),
      userAgreement: structuredClone(initialDocumentState),
      payment: initialPaymentState as IInitialPaymentOrder | null,
      is_paid: false,
      // Почта подтверждена кодом на шаге EmailInput. Флаг живёт в persist'е стора,
      // чтобы обновление страницы посреди регистрации не заставляло подтверждать
      // адрес заново. У регистраций, начатых до появления подтверждения, поля
      // просто нет (undefined = не подтверждена), но их шаг EmailInput уже
      // пройден — назад мы никого не возвращаем.
      emailVerified: false,
      // Учётка уже создана на сервере (createUser прошёл). Шаг пароля состоит из
      // двух сетевых операций (createUser → установка пароля): если вторая упала,
      // повтор без маркера снова звал бы createUser и упирался в «email занят».
      accountCreated: false,
    });

    const stepNames = [
      'EmailInput',
      'SetUserData',
      'SelectProgram',
      'GenerateAccount',
      'SelectBranch',
      'ReadStatement',
      'SignStatement',
      'PayInitial',
      'WaitingRegistration',
      'Welcome',
    ] as const;

    type StepName = (typeof stepNames)[number];

    const steps = stepNames.reduce(
      (acc, step, index) => {
        acc[step] = index + 1; // Индексы начинаются с 1
        return acc;
      },
      {} as Record<StepName, number>,
    );

    const system = useSystemStore();
    const isBranched = computed(
      () => system.info?.cooperator_account.is_branched,
    );

    // Доступные программы участия. Источник истины — бэкенд
    // (getRegistrationConfig возвращает их по coopname + типу аккаунта).
    // Фронт ничего не хардкодит: список зависит от того, какие приложения
    // (Благорост → Генератор/Благорост, Стол заказов → marketplace и т.д.)
    // установлены и активированы в кооперативе.
    const availablePrograms = ref<IRegistrationProgram[]>([]);

    // Подтягиваем программы под выбранный тип аккаунта. Вызывается из шага
    // SetUserData при переходе дальше — чтобы шаг SelectProgram уже знал,
    // показываться ему или нет (см. requiresProgramSelection / filteredSteps).
    const loadAvailablePrograms = async () => {
      const accountType = state.userData.type;
      if (!accountType || !system.info?.coopname) {
        availablePrograms.value = [];
        state.selectedProgramKey = '';
        return;
      }
      try {
        const { [Queries.System.GetRegistrationConfig.name]: config } =
          await client.Query(Queries.System.GetRegistrationConfig.query, {
            variables: {
              coopname: system.info.coopname,
              account_type: accountType,
            },
          });
        availablePrograms.value = config.programs ?? [];
      } catch (e) {
        console.error('Ошибка загрузки программ участия:', e);
        availablePrograms.value = [];
      }
      // Единственная программа — выбор не требуется, шаг скрыт, но программу
      // всё равно привязываем к пайщику (преселект). Иначе сохраняем уже
      // сделанный выбор, если он ещё валиден; сбрасываем — если программа
      // больше не доступна (сменили тип аккаунта) или программ нет вовсе.
      if (availablePrograms.value.length === 1) {
        state.selectedProgramKey = availablePrograms.value[0].key;
      } else if (
        !availablePrograms.value.some((p) => p.key === state.selectedProgramKey)
      ) {
        state.selectedProgramKey = '';
      }
    };

    // Выбор программы нужен только когда реально есть из чего выбирать (2+).
    const requiresProgramSelection = computed(
      () => availablePrograms.value.length > 1,
    );

    const filteredSteps = computed(() =>
      stepNames.filter((step) => {
        if (step === 'SelectBranch' && !isBranched.value) return false;
        if (step === 'SelectProgram' && !requiresProgramSelection.value) return false;
        return true;
      }),
    );

    // Индексы видимых шагов (1-based, в исходном порядке stepNames). По ним
    // ходят next/prev — чтобы скрытые шаги (SelectBranch без филиалов,
    // SelectProgram без выбора) перешагивались, а не давали пустой экран.
    const visibleStepIndices = computed(() =>
      filteredSteps.value.map((name) => steps[name]).sort((a, b) => a - b),
    );

    const isStepDone = (stepName: StepName) => {
      const stepIndex = steps[stepName];
      return stepIndex < state.step;
    };

    const isStep = (stepName: StepName) => {
      const stepIndex = steps[stepName];
      return stepIndex === state.step;
    };

    const next = () => {
      const target = visibleStepIndices.value.find((i) => i > state.step);
      if (target !== undefined) state.step = target;
    };

    const prev = () => {
      const visible = visibleStepIndices.value;
      for (let i = visible.length - 1; i >= 0; i--) {
        if (visible[i] < state.step) {
          state.step = visible[i];
          break;
        }
      }
    };

    const goTo = (targetStep: StepName) => {
      const targetIndex = steps[targetStep];
      if (targetIndex > 0) {
        state.step = targetIndex;
      }
    };

    // Сброс всех согласий и сгенерированных документов без затирания введённых
    // пользователем данных (userData/email). Нужен при возврате к редактированию
    // после отклонённого платежа: галочки «прочитал устав / согласие на ПД» и
    // подписи должны быть проставлены заново на повторном проходе.
    const resetConsents = () => {
      state.agreements = structuredClone(initialAgreementsState);
      state.signature = '';
      state.statement = structuredClone(initialDocumentState);
      state.walletAgreement = structuredClone(initialDocumentState);
      state.privacyAgreement = structuredClone(initialDocumentState);
      state.signatureAgreement = structuredClone(initialDocumentState);
      state.userAgreement = structuredClone(initialDocumentState);
    };

    const clearAddUserState = () =>
      reactive({
        spread_initial: false,
        created_at: '',
        initial: 0,
        minimum: 0,
        org_initial: 0,
        org_minimum: 0,
      });

    const addUserState = clearAddUserState();

    const clearUserData = () => {
      state.step = 1;
      state.selectedBranch = '';
      state.selectedProgramKey = '';
      availablePrograms.value = [];
      state.email = '';
      state.emailVerified = false;
      state.account = structuredClone(initialAccountState);
      state.agreements = structuredClone(initialAgreementsState);
      state.userData = structuredClone(initialUserDataState);
      state.payment = initialPaymentState;
      state.is_paid = false;
      state.accountCreated = false;
      state.statement = structuredClone(initialDocumentState);
      state.walletAgreement = structuredClone(initialDocumentState);
      state.privacyAgreement = structuredClone(initialDocumentState);
      state.signatureAgreement = structuredClone(initialDocumentState);
      state.userAgreement = structuredClone(initialDocumentState);
    };

    /**
     * Предзаполняет анкету вступления данными, перенесёнными по карте кооператора (story 9.3).
     *
     * Данные пришли от кооператива, где человека уже верифицировали, и проверены подписью
     * его заверенного ключа. Человек всё равно проходит форму и видит каждое поле:
     * перенос избавляет от перепечатывания, а не от проверки.
     *
     * Поля кладутся только совпадающие по смыслу: чего в нашей форме нет (паспорт, почта в
     * анкете), то не кладётся; чего не было в анкете — остаётся пустым и вводится руками.
     */
    const applyCardcoopProfile = (subjectType: string, profile: Record<string, any>): void => {
      const text = (value: unknown): string => (typeof value === 'string' ? value : '');

      if (typeof profile.email === 'string' && profile.email) state.email = profile.email;

      if (subjectType === 'individual') {
        state.userData.type = 'individual';
        Object.assign(state.userData.individual_data, {
          first_name: text(profile.first_name),
          last_name: text(profile.last_name),
          middle_name: text(profile.middle_name),
          birthdate: text(profile.birthdate),
          full_address: text(profile.full_address),
          phone: text(profile.phone),
        });
        return;
      }

      if (subjectType === 'entrepreneur') {
        state.userData.type = 'entrepreneur';
        Object.assign(state.userData.entrepreneur_data, {
          first_name: text(profile.first_name),
          last_name: text(profile.last_name),
          middle_name: text(profile.middle_name),
          birthdate: text(profile.birthdate),
          phone: text(profile.phone),
          city: text(profile.city),
          full_address: text(profile.full_address),
        });
        Object.assign(state.userData.entrepreneur_data.details, {
          inn: text(profile.details?.inn),
          ogrn: text(profile.details?.ogrn),
        });
        return;
      }

      if (subjectType === 'organization') {
        state.userData.type = 'organization';
        Object.assign(state.userData.organization_data, {
          short_name: text(profile.short_name),
          full_name: text(profile.full_name),
          city: text(profile.city),
          full_address: text(profile.full_address),
          fact_address: text(profile.fact_address),
          phone: text(profile.phone),
        });
        Object.assign(state.userData.organization_data.represented_by, {
          first_name: text(profile.represented_by?.first_name),
          last_name: text(profile.represented_by?.last_name),
          middle_name: text(profile.represented_by?.middle_name),
          position: text(profile.represented_by?.position),
          based_on: text(profile.represented_by?.based_on),
        });
        Object.assign(state.userData.organization_data.details, {
          inn: text(profile.details?.inn),
          ogrn: text(profile.details?.ogrn),
          kpp: text(profile.details?.kpp),
        });
      }
    };

    return {
      state,
      steps,
      filteredSteps,
      availablePrograms,
      requiresProgramSelection,
      loadAvailablePrograms,
      next,
      prev,
      goTo,
      isStepDone,
      isStep,
      clearUserData,
      resetConsents,
      applyCardcoopProfile,
      addUserState,
      isBranched,
    };
  },
  {
    persist: true,
  },
);
