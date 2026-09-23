<template lang="pug">
//- Вступление в двухпанельной оболочке (решение владельца 16.09.2026): шаги живут в
//- тёмной панели слева, справа — только текущий. Сами шаги остаются смонтированными
//- все сразу и показывают себя по v-show, как прежде в q-stepper: их наблюдатели за
//- номером шага, опросы оплаты и решения совета рассчитаны на это.
.signup-page
  AuthSplit(
    :eyebrow='coopTitle',
    :title='$t("registrator.signUp.title")',
    :lead='paneLead',
    :steps='paneSteps',
    :active-key='activeStepKey',
    :completed-keys='completedStepKeys',
    :step-eyebrow='workEyebrow',
    :heading='workHeading',
    size='lg'
  )
    template(#actions)
      AuthActions

    template(#pane-foot)
      | {{ $t('registrator.signUp.alreadyMemberText') }}
      |
      a.auth-link(href='#', @click.prevent='goToSignIn') {{ $t('registrator.signUp.signInLink') }}

    template(v-if='isRegistrationClosed')
      EmptyState.signup-page__closed(
        :title='$t("registrator.signUp.closedTitle")',
        :body='$t("registrator.signUp.closedBody")'
      )

    //- Совет принял: шаги свою работу сделали, вместо них — состояние входа в
    //- кабинет. Лоадер местный, страница не размонтируется (см. enterCabinet).
    .signup-page__enter(v-else-if='cabinetEntry')
      q-spinner.signup-page__enter-icon(v-if='cabinetEntry !== "error"', size='40px', color='primary')
      q-icon.signup-page__enter-icon(v-else, name='cloud_off', size='40px')
      p.signup-page__enter-title {{ cabinetEntryTitle }}
      p.signup-page__enter-caption {{ cabinetEntryCaption }}

    template(v-else)
      EmailInput

      SetUserData

      SelectProgram(v-if='registratorStore.requiresProgramSelection')

      IntakeStep(v-if='registratorStore.requiresIntake')

      GenerateAccount

      SelectBranch(v-if='isBranched')

      ReadStatement

      SignStatement

      PayInitial

      WaitingRegistration

      Welcome
</template>

<script lang="ts" setup>
import { watch, onMounted, onBeforeUnmount, computed, ref } from 'vue';
import EmailInput from './EmailInput.vue';
import GenerateAccount from './GenerateAccount.vue';
import SetUserData from './SetUserData.vue';
import SelectProgram from './SelectProgram.vue';
import IntakeStep from './IntakeStep.vue';
import SignStatement from './SignStatement.vue';
import ReadStatement from './ReadStatement.vue';
import PayInitial from './PayInitial.vue';
import WaitingRegistration from './WaitingRegistration.vue';
import SelectBranch from './SelectBranch.vue';
import Welcome from './Welcome.vue';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { EmptyState } from 'src/shared/ui/base/EmptyState';

import { useRegistratorStore } from 'src/entities/Registrator';
import { useSessionStore } from 'src/entities/Session';
import { useAccountStore } from 'src/entities/Account';
import { useAgreementStore } from 'src/entities/Agreement';
import { useNotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';

import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import { useDesktopStore } from 'src/entities/Desktop';
import { Zeus } from '@coopenomics/sdk';
import { updateOpenReplayUser } from 'src/shared/config';
import { t } from 'src/shared/i18n';

const session = useSessionStore();
const router = useRouter();
const registratorStore = useRegistratorStore();
const { state, clearUserData, steps } = registratorStore;
const store = state;
const agreementer = useAgreementStore();
const desktops = useDesktopStore();
const accountStore = useAccountStore();
const system = useSystemStore();
const { info } = system;

const isRegistrationClosed = computed(() => info.settings?.is_registration_open === false);


// Диалог разрешения уведомлений
const { showDialog } = useNotificationPermissionDialog();

onMounted(() => {
  if (info.coopname) {
    agreementer.loadCooperativeAgreements(info.coopname);
  }
  if (!session.isRegistrationComplete) {
    const userStatus = session.providerAccount?.status;
    if (
      userStatus === Zeus.UserStatus.Registered ||
      userStatus === Zeus.UserStatus.Active ||
      userStatus === Zeus.UserStatus.Blocked
    ) {
      store.step = steps.WaitingRegistration;
      return;
    }
    // Незавершённый вступительный платёж. PENDING означает «счёт выставлен», а НЕ
    // «деньги получены»: строку счёта мы создаём сразу при заходе на шаг оплаты.
    // Поэтому на экран ожидания/отказа ведём ТОЛЬКО когда деньги уже поступили
    // (PAID/COMPLETED) либо платёж в терминальном статусе (отказ/отмена/возврат).
    // Приоритет над статусом: при отказе платежа показываем причину, а не гоним
    // «оплатить заново».
    const regPaymentStatus = session.registrationPayment?.status;
    if (regPaymentStatus && regPaymentStatus !== Zeus.PaymentStatus.PENDING) {
      store.step = steps.WaitingRegistration;
      return;
    }
    // Сервер — источник истины о шаге: заявление подписано (Joined) либо счёт
    // выставлен, но не оплачен (PENDING) → возвращаем на шаг оплаты (там QR +
    // поллинг приёма денег). Так процесс переживает перезагрузку и открытие в
    // другой вкладке, не завися от localStorage.
    if (
      regPaymentStatus === Zeus.PaymentStatus.PENDING ||
      userStatus === Zeus.UserStatus.Joined
    ) {
      store.step = steps.PayInitial;
      return;
    }
  }
  void returnToUnansweredIntake();
});

/**
 * Вступление, начатое до появления анкет (или до включения приложения, которое
 * анкету требует либо добавляет вторую программу), могло уйти дальше выбора
 * программы и шага «Сведения о себе». Сервер такое
 * заявление без ответов не примет — возвращаем человека на анкету заранее, а не
 * показываем отказ на подписи. Касается только шагов до подписи включительно:
 * подписанное заявление сервер уже принял.
 */
const returnToUnansweredIntake = async (): Promise<void> => {
  if (store.step <= steps.SelectProgram || store.step > steps.SignStatement) return;
  await registratorStore.loadAvailablePrograms();
  // Программ стало несколько, а выбора нет (прежний был сделан системой, когда
  // программа была единственной) — выбирать должен человек.
  if (registratorStore.requiresProgramSelection && !store.selectedProgramKey) {
    store.step = steps.SelectProgram;
    return;
  }
  if (store.step > steps.IntakeStep && registratorStore.requiresIntake && !registratorStore.isIntakeComplete) {
    store.step = steps.IntakeStep;
  }
};

// Догружаем cooperativeAgreements, когда system_info прорастёт.
// До этого onMounted мог отработать на пустом info.coopname.
watch(
  () => info.coopname,
  (cn) => {
    if (cn) agreementer.loadCooperativeAgreements(cn);
  },
);

/**
 * Увести со страницы регистрации в кабинет. Зовётся только при `isFullyActive`:
 * страж навигации непринятого пайщика с защищённых страниц всё равно вернёт
 * на регистрацию, так что уходить раньше бессмысленно.
 */
const goToCabinet = (): void => {
  const target = desktops.getDefaultPageRoute();
  if (target && target.name !== 'signup') {
    desktops.goToDefaultPage(router);
    return;
  }
  // Стол не загрузился — идём на маршрут для принятых напрямую.
  const authorized = info?.settings?.authorized_default_route;
  void router.push(
    authorized
      ? { name: authorized, params: { coopname: info.coopname } }
      : { name: 'index', params: { coopname: info.coopname } },
  );
};

/**
 * Вход в кабинет после приёма советом.
 *
 * Как это ломалось раньше (08.09.2026, один браузер — 558 ошибок за минуту при
 * перезапуске узла). Наблюдатель с `deep: true` смотрел на объект
 * `participant_account`, а каждая перечитка аккаунта — опрос шага оплаты, опрос
 * ожидания, дозагрузка прав в страже — подставляет новый объект, и обработчик
 * запускался снова при тех же данных. Он включал глобальный лоадер стола, от
 * которого layout снимает `router-view`, то есть размонтировал эту страницу со
 * всеми шагами; при любой ошибке всё равно уходил в кабинет; страж возвращал
 * непринятого пайщика на регистрацию, страница монтировалась заново вместе с
 * опросами, страж по дороге перечитывал аккаунт — и круг замыкался. Вкладка
 * копила таймеры и запросы, пока не возвращалась связь.
 *
 * Теперь: срабатывание по факту приёма (false → true), один раз на страницу;
 * лоадер местный, страница живёт; в кабинет — только когда статус пайщика уже
 * `active` (иначе страж вернёт обратно); при обрыве связи остаёмся здесь и
 * повторяем попытку, когда узел ответит.
 *
 * Про статус. Приём советом доходит до нас двумя путями с разной задержкой:
 * `participant_account` читается из таблицы цепи и появляется сразу, а
 * `users.status = active` выставляет слушатель события `soviet::addpartcpnt`,
 * которое контроллер эмитит с задержкой (`action_emit_delay_ms`). В этом
 * промежутке опрашиваем аккаунт, а не уходим с отставшим статусом.
 */
type CabinetEntryState = 'loading' | 'waiting-status' | 'error';
const cabinetEntry = ref<CabinetEntryState | null>(null);

const STATUS_POLL_MS = 3_000;
const RETRY_AFTER_ERROR_MS = 5_000;

const cabinetEntryTitle = computed(() =>
  cabinetEntry.value === 'error' ? t('registrator.signUp.cabinetErrorTitle') : t('registrator.signUp.cabinetSuccessTitle'),
);
const cabinetEntryCaption = computed(() => {
  switch (cabinetEntry.value) {
    case 'waiting-status':
      return t('registrator.signUp.cabinetWaitingCaption');
    case 'error':
      return t('registrator.signUp.cabinetErrorCaption');
    default:
      return t('registrator.signUp.cabinetOpeningCaption');
  }
});

const coopTitle = computed(() => system.cooperativeDisplayName);

type StepName = keyof typeof steps;

/**
 * Подписи шагов для панели и заголовки рабочей области. Раньше заголовки жили в
 * каждом шаге (`q-step title=`); теперь шаг показывает только своё содержимое, а
 * где он в пути и как называется — говорит оболочка. Welcome в панели не значится:
 * это итог, а не шаг.
 */
const STEP_TEXT: Record<StepName, { label: string; heading: string }> = {
  EmailInput: { label: t('registrator.signUp.step.emailInput.label'), heading: t('registrator.signUp.step.emailInput.heading') },
  SetUserData: { label: t('registrator.signUp.step.setUserData.label'), heading: t('registrator.signUp.step.setUserData.heading') },
  SelectProgram: { label: t('registrator.signUp.step.selectProgram.label'), heading: t('registrator.signUp.step.selectProgram.heading') },
  IntakeStep: { label: t('registrator.signUp.step.intakeStep.label'), heading: t('registrator.signUp.step.intakeStep.heading') },
  GenerateAccount: { label: t('registrator.signUp.step.generateAccount.label'), heading: t('registrator.signUp.step.generateAccount.heading') },
  SelectBranch: { label: t('registrator.signUp.step.selectBranch.label'), heading: t('registrator.signUp.step.selectBranch.heading') },
  ReadStatement: { label: t('registrator.signUp.step.readStatement.label'), heading: t('registrator.signUp.step.readStatement.heading') },
  SignStatement: { label: t('registrator.signUp.step.signStatement.label'), heading: t('registrator.signUp.step.signStatement.heading') },
  PayInitial: { label: t('registrator.signUp.step.payInitial.label'), heading: t('registrator.signUp.step.payInitial.heading') },
  WaitingRegistration: { label: t('registrator.signUp.step.waitingRegistration.label'), heading: t('registrator.signUp.step.waitingRegistration.heading') },
  Welcome: { label: t('registrator.signUp.step.welcome.label'), heading: t('registrator.signUp.step.welcome.heading') },
};

const visibleStepNames = computed(() => registratorStore.filteredSteps as readonly StepName[]);
const paneStepNames = computed(() => visibleStepNames.value.filter((name) => name !== 'Welcome'));
const paneSteps = computed(() =>
  paneStepNames.value.map((name) => ({ key: name, label: STEP_TEXT[name].label })),
);
const activeStepName = computed<StepName>(
  () => (visibleStepNames.value.find((name) => steps[name] === store.step) ?? 'EmailInput'),
);
const activeStepKey = computed(() => activeStepName.value);
const completedStepKeys = computed(() =>
  paneStepNames.value.filter((name) => steps[name] < store.step),
);
const paneLead = computed(() => {
  const n = paneStepNames.value.length;
  return t('registrator.signUp.stepsLead', { stepsCount: n });
});
const workEyebrow = computed(() => {
  if (cabinetEntry.value) return t('registrator.signUp.workEyebrowDone');
  if (activeStepName.value === 'Welcome') return t('registrator.signUp.workEyebrowReady');
  const idx = paneStepNames.value.indexOf(activeStepName.value);
  return idx >= 0 ? t('registrator.signUp.stepProgress', { stepNumber: idx + 1, stepsTotal: paneStepNames.value.length }) : '';
});
const workHeading = computed(() => {
  if (isRegistrationClosed.value) return t('registrator.signUp.workHeadingClosed');
  if (cabinetEntry.value) return cabinetEntryTitle.value;
  if (activeStepName.value === 'Welcome') return t('registrator.signUp.welcomeHeading', { coopName: coopTitle.value });
  return STEP_TEXT[activeStepName.value].heading;
});

const goToSignIn = (): void => {
  void router.push({ name: 'signin', params: { coopname: info.coopname } });
};

let cabinetEntryTimer: ReturnType<typeof setTimeout> | null = null;
let cabinetEntryRunning = false;
let isUnmounted = false;

const scheduleCabinetEntry = (delayMs: number): void => {
  if (isUnmounted) return;
  if (cabinetEntryTimer) clearTimeout(cabinetEntryTimer);
  cabinetEntryTimer = setTimeout(() => {
    cabinetEntryTimer = null;
    void enterCabinet();
  }, delayMs);
};

const enterCabinet = async (): Promise<void> => {
  if (isUnmounted || cabinetEntryRunning) return;
  cabinetEntryRunning = true;
  try {
    if (!session.isFullyActive) {
      const fresh = await accountStore.getAccount(session.username);
      if (fresh) session.setCurrentUserAccount(fresh);
    }
    if (isUnmounted) return;
    if (!session.isFullyActive) {
      cabinetEntry.value = 'waiting-status';
      scheduleCabinetEntry(STATUS_POLL_MS);
      return;
    }
    cabinetEntry.value = 'loading';

    // Кошелёк принятого пайщика: от него зависят canContribute и
    // isWalletAgreementSigned, без него кнопки взноса и возврата появятся
    // только после F5. Ошибки внутри run обрабатываются им самим.
    const { run } = useInitWalletProcess();
    await run(true);

    // Столы и гранты с бэка (DesktopWorkspace.grants): без них grant-gated
    // кнопки тоже появятся только после F5, когда init-app вызовет loadDesktop.
    await desktops.loadDesktop();
    if (isUnmounted) return;

    // Стол пересчитываем по новой роли, сохранённый выбор игнорируем.
    desktops.selectDefaultWorkspace(true);
    goToCabinet();

    setTimeout(() => {
      showDialog();
    }, 1000);
  } catch (e) {
    console.error('Не удалось открыть кабинет после приёма:', e);
    cabinetEntry.value = 'error';
    scheduleCabinetEntry(RETRY_AFTER_ERROR_MS);
  } finally {
    cabinetEntryRunning = false;
  }
};

// Узел снова отвечает — не ждём таймера повтора.
watch(
  () => system.backendAvailable,
  (available) => {
    if (available && cabinetEntry.value === 'error') scheduleCabinetEntry(0);
  },
);

onBeforeUnmount(() => {
  isUnmounted = true;
  if (cabinetEntryTimer) clearTimeout(cabinetEntryTimer);
  if (store.step == steps.Welcome) {
    clearUserData();
  }
});

watch(
  () => Boolean(session.currentUserAccount?.participant_account),
  (accepted) => {
    if (!accepted || cabinetEntry.value) return;
    cabinetEntry.value = 'loading';
    clearUserData();

    // Обновляем username в OpenReplay tracker при завершении регистрации
    updateOpenReplayUser({
      username: session.username,
      coopname: info.coopname,
      cooperativeDisplayName: system.cooperativeDisplayName,
    });

    void enterCabinet();
  },
);

watch(
  () => [store.step, store.email, store.account, store.userData],
  () => {
    if (
      store.step >= steps.GenerateAccount &&
      store.step < steps.WaitingRegistration
    ) {
      useInitWalletProcess().run();
    }
  },
);

const isBranched = computed(() => info.cooperator_account.is_branched);
</script>

<style scoped>
.signup-page {
  min-height: inherit;
}
.signup-page__closed {
  padding: var(--p-4, 16px) 0;
}
.signup-page__enter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-6, 24px) 0;
  text-align: center;
}
.signup-page__enter-icon {
  color: var(--p-ink-3, var(--p-ink-2));
}
.signup-page__enter-title {
  margin: var(--p-2, 8px) 0 0;
  font-weight: 600;
}
.signup-page__enter-caption {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3, var(--p-ink-2));
}
</style>
