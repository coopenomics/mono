import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { IGeneratedAccount } from 'src/shared/lib/types/user';
import { type IUserData } from 'src/shared/lib/types/user/IUserData';
import type { IMetaDocument } from '@coopenomics/docs-templates';
import { useSystemStore } from 'src/entities/System/model';
import type { IDocument, ISignatureInfo } from 'src/shared/lib/types/document';
import { Zeus, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IInitialPaymentOrder } from 'src/shared/lib/types/payments';
import { intakeFormProblems } from 'src/shared/lib/intake-schema';
import { useSessionStore } from 'src/entities/Session';
import { useGlobalStore } from 'src/shared/store';
import { decideResume, isPasswordStepDone, nextVisibleStep } from '../lib/registration-resume';

// Программа участия в регистрации — тип берётся напрямую из SDK-выдачи
// getRegistrationConfig, не переописывается.
type IRegistrationProgram =
  Queries.System.GetRegistrationConfig.IOutput['getRegistrationConfig']['programs'][number];

// Анкета вступления, которую объявило расширение (или ядро) для программы
// либо типа аккаунта. Поля описаны JSON Schema — их рисует общая форма ZodForm.
export type IRegistrationIntakeForm =
  Queries.System.GetRegistrationConfig.IOutput['getRegistrationConfig']['intake_forms'][number];

// Сведения о пайщике, которые хранит узел, — из выдачи getAccount.
type IResumedPrivateAccount = NonNullable<
  Queries.Accounts.GetAccount.IOutput[typeof Queries.Accounts.GetAccount.name]['private_account']
>;

const namespace = 'registrator';

// Начальные состояния — фабрики: каждый вызов даёт новый объект, и сброс формы
// не делит вложенные блоки между прежней и новой анкетой. structuredClone здесь
// был нельзя: сборка объявляет Chrome 87 / Safari 13.1, а функция появилась в
// Chrome 98 / Safari 15.4 — на таких браузерах страница регистрации не
// монтировалась (GlitchTip #75, C28-94).
// Начальное состояние для account
const initialAccountState = (): IGeneratedAccount => ({
  username: '',
  private_key: '',
  public_key: '',
});

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
const initialUserDataState = (): IUserDataState => ({
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
});

// Начальное состояние для любого документа
const initialDocumentState = (): IDocument => ({
  hash: '',
  meta: {} as IMetaDocument,
  meta_hash: '',
  version: '',
  doc_hash: '',
  signatures: [] as ISignatureInfo[],
});

// Начальное состояние для payment
const initialPaymentState: IInitialPaymentOrder | null = null;

// Начальное состояние для agreements
const initialAgreementsState = () => ({
  condidential: false,
  digital_signature: false,
  wallet: false,
  ustav: false,
  user: false,
  self_paid: false,
});
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
      // Программу выбрал не человек, а система — она была единственной. Если
      // позже программ станет больше (совет подключил ещё одно приложение), такой
      // выбор сбрасывается: человек должен выбрать сам, а не унаследовать.
      programAutoSelected: false,
      // Ответы на анкеты вступления: идентификатор анкеты → значения полей.
      intakeAnswers: {} as Record<string, Record<string, unknown>>,
      account: initialAccountState(),
      userData: initialUserDataState(),
      signature: '',
      inLoading: false,
      agreements: initialAgreementsState(),
      statement: initialDocumentState(),
      walletAgreement: initialDocumentState(),
      privacyAgreement: initialDocumentState(),
      signatureAgreement: initialDocumentState(),
      userAgreement: initialDocumentState(),
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
      'IntakeStep',
      'GenerateAccount',
      'SelectBranch',
      'ReadStatement',
      'SignStatement',
      'PayInitial',
      'WaitingRegistration',
      'Welcome',
    ] as const;

    type StepName = (typeof stepNames)[number];

    // Номер шага хранится в persist'е, поэтому у прежних шагов он меняться не
    // должен: иначе человек, начавший вступление до обновления, окажется на
    // другом шаге. Шаг анкеты добавлен позже и встаёт между соседями дробным
    // номером — сравнения и сортировка по номерам работают как прежде.
    const LATE_STEPS: Partial<Record<StepName, number>> = { IntakeStep: 3.5 };
    const steps = stepNames
      .filter((step) => LATE_STEPS[step] === undefined)
      .reduce(
        (acc, step, index) => {
          acc[step] = index + 1; // Индексы начинаются с 1
          return acc;
        },
        { ...LATE_STEPS } as Record<StepName, number>,
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

    // Анкеты, общие для типа аккаунта (не зависят от программы). Анкеты
    // программы приходят внутри неё самой.
    const commonIntakeForms = ref<IRegistrationIntakeForm[]>([]);

    // Подтягиваем программы под выбранный тип аккаунта. Вызывается из шага
    // SetUserData при переходе дальше — чтобы шаг SelectProgram уже знал,
    // показываться ему или нет (см. requiresProgramSelection / filteredSteps).
    const loadAvailablePrograms = async () => {
      const accountType = state.userData.type;
      if (!accountType || !system.info?.coopname) {
        availablePrograms.value = [];
        commonIntakeForms.value = [];
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
        commonIntakeForms.value = config.intake_forms ?? [];
      } catch (e) {
        console.error('Ошибка загрузки программ участия:', e);
        availablePrograms.value = [];
        commonIntakeForms.value = [];
      }
      // Единственная программа — выбор не требуется, шаг скрыт, но программу
      // всё равно привязываем к пайщику (преселект). Иначе сохраняем уже
      // сделанный выбор, если он ещё валиден; сбрасываем — если программа
      // больше не доступна (сменили тип аккаунта) или программ нет вовсе.
      if (availablePrograms.value.length === 1) {
        state.selectedProgramKey = availablePrograms.value[0].key;
        state.programAutoSelected = true;
      } else if (
        state.programAutoSelected ||
        !availablePrograms.value.some((p) => p.key === state.selectedProgramKey)
      ) {
        state.selectedProgramKey = '';
        state.programAutoSelected = false;
      }
    };

    // Выбор программы нужен только когда реально есть из чего выбирать (2+).
    const requiresProgramSelection = computed(
      () => availablePrograms.value.length > 1,
    );

    // Анкеты, которые заполняет этот заявитель: общие для типа аккаунта плюс
    // анкеты выбранной программы. Что именно требовать, решает бэкенд — тот же
    // набор он сверит при приёме заявления.
    const intakeForms = computed<IRegistrationIntakeForm[]>(() => {
      const program = availablePrograms.value.find((p) => p.key === state.selectedProgramKey);
      const byId = new Map<string, IRegistrationIntakeForm>();
      for (const form of [...commonIntakeForms.value, ...(program?.intake_forms ?? [])]) {
        byId.set(form.id, form);
      }
      return Array.from(byId.values()).sort((a, b) => a.order - b.order);
    });

    const requiresIntake = computed(() => intakeForms.value.length > 0);

    // Все анкеты заполнены так, что сервер их примет (обязательность и длина).
    const isIntakeComplete = computed(() =>
      intakeForms.value.every(
        (form) => intakeFormProblems(form.schema, state.intakeAnswers[form.id]).length === 0,
      ),
    );

    // Ответы для отправки: только по анкетам текущего набора. Ответы на анкеты
    // другой программы (человек вернулся и передумал) на сервер не уходят.
    // Незаполненные необязательные поля (null) отбрасываются.
    const intakeAnswersForSubmit = computed(() =>
      intakeForms.value.map((form) => ({
        form_id: form.id,
        values: Object.fromEntries(
          Object.entries(state.intakeAnswers[form.id] ?? {}).filter(
            ([, value]) => value !== null && value !== undefined && value !== '',
          ),
        ),
      })),
    );

    const filteredSteps = computed(() =>
      stepNames.filter((step) => {
        if (step === 'SelectBranch' && !isBranched.value) return false;
        if (step === 'SelectProgram' && !requiresProgramSelection.value) return false;
        if (step === 'IntakeStep' && !requiresIntake.value) return false;
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

    // Шаг пароля пройден: учётка создана и сервер подтверждает пароль
    // (см. isPasswordStepDone — одной отметки «учётка создана» мало).
    const passwordStepDone = computed(() =>
      isPasswordStepDone(state.accountCreated, useSessionStore().currentUserAccount?.has_password),
    );

    const next = () => {
      // Пройденный шаг пароля вперёд не повторяем: сюда попадают те, кого
      // вернули к выбору программы или к анкете.
      const target = nextVisibleStep(
        visibleStepIndices.value,
        state.step,
        steps.GenerateAccount,
        passwordStepDone.value,
      );
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
      state.agreements = initialAgreementsState();
      state.signature = '';
      state.statement = initialDocumentState();
      state.walletAgreement = initialDocumentState();
      state.privacyAgreement = initialDocumentState();
      state.signatureAgreement = initialDocumentState();
      state.userAgreement = initialDocumentState();
    };

    /**
     * Продолжить вступление, учётка которого уже есть на узле (статус «создан»),
     * а этот браузер о ней не знает.
     *
     * Так бывает в двух случаях. Вступление начали на другом устройстве: пароль
     * поставлен, человек вошёл им здесь, а шаги и анкета остались в браузере
     * первого устройства. Либо сбой оборвал шаг пароля сразу после создания
     * учётки: ключ записан, отметка «учётка создана» — нет, и повтор упирался в
     * занятую почту (16.10.2026, стенд 5).
     *
     * Анкету сервер уже принял, повторять её незачем. Без пароля ведём на шаг
     * пароля: без него не войти ни с какого устройства. С паролем — к заявлению.
     */
    const resumeCreatedAccount = (input: {
      username: string;
      email: string;
      publicKey: string;
      // Пусто, когда ключ живёт в сессии входа по паролю, а не в этом браузере.
      privateKey: string;
      privateAccount?: IResumedPrivateAccount | null;
      step: number;
    }): void => {
      resetConsents();
      state.account = {
        username: input.username,
        private_key: input.privateKey,
        public_key: input.publicKey,
      };
      state.email = input.email;
      state.emailVerified = true;
      state.accountCreated = true;
      applyPrivateAccount(input.privateAccount);
      state.step = input.step;
    };

    /**
     * Продолжить вступление вошедшего пайщика, если его учётка создана, а этот
     * браузер о ней не знает либо пароль у неё не стоит. Одна точка для всех
     * путей: страница регистрации, вход по ключу, вход по паролю. Решение — в
     * decideResume; признак пароля — только серверный: `isCoopIdSession`
     * выставляет и серверный рендер по cookie, в том числе при входе по ключу.
     */
    const resumeFromSession = (): void => {
      const session = useSessionStore();
      const provider = session.providerAccount;
      const decision = decideResume({
        isAuth: session.isAuth,
        username: session.username,
        isCreated: provider?.status === Zeus.UserStatus.Created,
        hasPassword: session.currentUserAccount?.has_password,
        known: {
          accountCreated: state.accountCreated,
          username: state.account.username,
          step: state.step,
        },
        steps,
        isBranched: isBranched.value,
      });
      if (decision.kind === 'step') state.step = decision.step;
      if (decision.kind !== 'adopt' || !provider) return;
      resumeCreatedAccount({
        username: session.username,
        email: provider.email,
        publicKey: provider.public_key,
        privateKey: useGlobalStore().wif?.toString() ?? '',
        privateAccount: session.privateAccount,
        step: decision.step,
      });
    };

    /** Тип субъекта и его анкета — из сведений, которые узел хранит о пайщике. */
    const applyPrivateAccount = (privateAccount?: IResumedPrivateAccount | null): void => {
      const type = privateAccount?.type;
      if (type === 'individual' && privateAccount?.individual_data) {
        Object.assign(state.userData.individual_data, privateAccount.individual_data);
      } else if (type === 'organization' && privateAccount?.organization_data) {
        Object.assign(state.userData.organization_data, privateAccount.organization_data);
      } else if (type === 'entrepreneur' && privateAccount?.entrepreneur_data) {
        Object.assign(state.userData.entrepreneur_data, privateAccount.entrepreneur_data);
      }
      if (type === 'individual' || type === 'organization' || type === 'entrepreneur') {
        state.userData.type = type;
      }
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
      state.programAutoSelected = false;
      state.intakeAnswers = {};
      availablePrograms.value = [];
      commonIntakeForms.value = [];
      state.email = '';
      state.emailVerified = false;
      state.account = initialAccountState();
      state.agreements = initialAgreementsState();
      state.userData = initialUserDataState();
      state.payment = initialPaymentState;
      state.is_paid = false;
      state.accountCreated = false;
      state.statement = initialDocumentState();
      state.walletAgreement = initialDocumentState();
      state.privacyAgreement = initialDocumentState();
      state.signatureAgreement = initialDocumentState();
      state.userAgreement = initialDocumentState();
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
      commonIntakeForms,
      intakeForms,
      requiresIntake,
      isIntakeComplete,
      intakeAnswersForSubmit,
      loadAvailablePrograms,
      next,
      prev,
      goTo,
      isStepDone,
      isStep,
      clearUserData,
      resetConsents,
      resumeFromSession,
      passwordStepDone,
      applyCardcoopProfile,
      addUserState,
      isBranched,
    };
  },
  {
    persist: true,
  },
);
