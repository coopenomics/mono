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

// Начальное состояние для userData
const initialUserDataState: IUserData = {
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
/** Строка из значения профиля карты кооператора: не строка — пустая строка. */
const cardcoopText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Вложенный блок профиля (`details`, `represented_by`): блока может не быть — тогда пустой. */
const cardcoopBlock = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/**
 * Ветка переноса для физлица. Вынесена из applyCardcoopProfile: три ветки
 * анкеты независимы и читаются каждая отдельно.
 */
const fillIndividualFromCardcoop = (
  individual: NonNullable<IUserData['individual_data']>,
  profile: Record<string, unknown>,
): void => {
  Object.assign(individual, {
    first_name: cardcoopText(profile.first_name),
    last_name: cardcoopText(profile.last_name),
    middle_name: cardcoopText(profile.middle_name),
    birthdate: cardcoopText(profile.birthdate),
    full_address: cardcoopText(profile.full_address),
    phone: cardcoopText(profile.phone),
  });
};

/** Ветка переноса для ИП: анкета плюс реквизиты (ИНН, ОГРНИП). */
const fillEntrepreneurFromCardcoop = (
  entrepreneur: NonNullable<IUserData['entrepreneur_data']>,
  profile: Record<string, unknown>,
): void => {
  Object.assign(entrepreneur, {
    first_name: cardcoopText(profile.first_name),
    last_name: cardcoopText(profile.last_name),
    middle_name: cardcoopText(profile.middle_name),
    birthdate: cardcoopText(profile.birthdate),
    phone: cardcoopText(profile.phone),
    city: cardcoopText(profile.city),
    full_address: cardcoopText(profile.full_address),
  });
  const details = cardcoopBlock(profile.details);
  Object.assign(entrepreneur.details, {
    inn: cardcoopText(details.inn),
    ogrn: cardcoopText(details.ogrn),
  });
};

/** Ветка переноса для организации: анкета, представитель и реквизиты. */
const fillOrganizationFromCardcoop = (
  organization: NonNullable<IUserData['organization_data']>,
  profile: Record<string, unknown>,
): void => {
  Object.assign(organization, {
    short_name: cardcoopText(profile.short_name),
    full_name: cardcoopText(profile.full_name),
    city: cardcoopText(profile.city),
    full_address: cardcoopText(profile.full_address),
    fact_address: cardcoopText(profile.fact_address),
    phone: cardcoopText(profile.phone),
  });
  const representative = cardcoopBlock(profile.represented_by);
  Object.assign(organization.represented_by, {
    first_name: cardcoopText(representative.first_name),
    last_name: cardcoopText(representative.last_name),
    middle_name: cardcoopText(representative.middle_name),
    position: cardcoopText(representative.position),
    based_on: cardcoopText(representative.based_on),
  });
  const details = cardcoopBlock(profile.details);
  Object.assign(organization.details, {
    inn: cardcoopText(details.inn),
    ogrn: cardcoopText(details.ogrn),
    kpp: cardcoopText(details.kpp),
  });
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
      if (typeof profile.email === 'string' && profile.email) state.email = profile.email;

      // Блоки анкеты в IUserData необязательны, поэтому перед записью берём блок
      // в локальную переменную и проверяем его наличие.
      if (subjectType === 'individual') {
        state.userData.type = 'individual';
        const individual = state.userData.individual_data;
        if (individual) fillIndividualFromCardcoop(individual, profile);
        return;
      }

      if (subjectType === 'entrepreneur') {
        state.userData.type = 'entrepreneur';
        const entrepreneur = state.userData.entrepreneur_data;
        if (entrepreneur) fillEntrepreneurFromCardcoop(entrepreneur, profile);
        return;
      }

      if (subjectType === 'organization') {
        state.userData.type = 'organization';
        const organization = state.userData.organization_data;
        if (organization) fillOrganizationFromCardcoop(organization, profile);
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
