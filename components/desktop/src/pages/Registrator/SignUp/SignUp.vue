<template lang="pug">
.signup-page
  AuthCard.signup-page__card(:max-width='720', title='Вступить в пайщики')
    template(v-if='isRegistrationClosed')
      EmptyState.signup-page__closed(
        title='Регистрация временно недоступна',
        body='Кооператив завершает подготовку к приёму новых пайщиков. Пожалуйста, зайдите позже.'
      )

    q-stepper.signup-page__stepper(
      v-else,
      v-model='store.step',
      vertical,
      animated,
      flat,
      done-color='primary'
    )
      EmailInput

      SetUserData

      SelectProgram(v-if='registratorStore.requiresProgramSelection')

      GenerateAccount

      SelectBranch(v-if='isBranched')

      ReadStatement

      SignStatement

      PayInitial

      WaitingRegistration

  .signup-page__restart(v-if='!isRegistrationClosed')
    q-btn(@click='out', dense, size='sm', flat color='grey') начать с начала
</template>

<script lang="ts" setup>
import { watch, onMounted, onBeforeUnmount, computed } from 'vue';
import EmailInput from './EmailInput.vue';
import GenerateAccount from './GenerateAccount.vue';
import SetUserData from './SetUserData.vue';
import SelectProgram from './SelectProgram.vue';
import SignStatement from './SignStatement.vue';
import ReadStatement from './ReadStatement.vue';
import PayInitial from './PayInitial.vue';
import WaitingRegistration from './WaitingRegistration.vue';
import SelectBranch from './SelectBranch.vue';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';

import { useRegistratorStore } from 'src/entities/Registrator';
import { useLogoutUser } from 'src/features/User/Logout';
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
});

// Догружаем cooperativeAgreements, когда system_info прорастёт.
// До этого onMounted мог отработать на пустом info.coopname.
watch(
  () => info.coopname,
  (cn) => {
    if (cn) agreementer.loadCooperativeAgreements(cn);
  },
);

/**
 * Дождаться, пока сервер поднимет `users.status` до `active`.
 *
 * Ограничено по времени: если событие приёма потерялось, ждать бесконечно
 * нельзя — пайщик уже принят цепью, и держать его на форме регистрации хуже,
 * чем открыть кабинет с чуть отставшим статусом (ближайшее обновление аккаунта
 * его подтянет).
 */
const waitForActiveStatus = async (): Promise<void> => {
  const deadline = Date.now() + 8000;
  while (!session.isFullyActive && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const fresh = await accountStore.getAccount(session.username);
      if (fresh) session.setCurrentUserAccount(fresh);
    } catch {
      // Сеть моргнула — повторим на следующем витке, выходить по одной осечке незачем.
    }
  }
};

/**
 * Увести со страницы регистрации в кабинет.
 *
 * `goToDefaultPage` сам по себе не годится: пока статус не `active`, он считает
 * пайщика неавторизованным и возвращает `signup` — ту самую страницу. Поэтому
 * если он предлагает остаться здесь же, уходим на маршрут для принятых: право
 * на кабинет доказано записью пайщика в цепи, а не отставшим полем в базе.
 */
const goToCabinet = (): void => {
  const target = desktops.getDefaultPageRoute();
  if (target && target.name !== 'signup') {
    desktops.goToDefaultPage(router);
    return;
  }
  const authorized = info?.settings?.authorized_default_route;
  void router.push(
    authorized
      ? { name: authorized, params: { coopname: info.coopname } }
      : { name: 'index', params: { coopname: info.coopname } },
  );
  desktops.setWorkspaceChanging(false);
};

const out = async () => {
  const { logout } = await useLogoutUser();
  await logout();
  window.location.reload();
};

onBeforeUnmount(() => {
  if (store.step == steps.Welcome) {
    clearUserData();
  }
});

watch(
  () => session.currentUserAccount?.participant_account,
  async (newValue) => {
    if (newValue) {
      clearUserData();

      // Обновляем username в OpenReplay tracker при завершении регистрации
      updateOpenReplayUser({
        username: session.username,
        coopname: info.coopname,
        cooperativeDisplayName: system.cooperativeDisplayName,
      });

      // Включаем лоадер для плавного перехода
      desktops.setWorkspaceChanging(true);

      try {
        // Принудительно перезагружаем данные пользователя для получения обновленной роли
        const { run } = useInitWalletProcess();
        await run(true); // forceReload = true

        // Дожидаемся завершения загрузки данных
        let attempts = 0;
        const maxAttempts = 50; // 5 секунд максимум

        while (!session.loadComplete && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        // Пайщик стал active (совет принял решение) — статус обновился выше.
        // На момент первого run() статус мог быть ещё не 'active', поэтому
        // isFullyActive не сработал и кошелёк/agreements не загрузились.
        // Повторный run(true) подтягивает кошелёк актуального пользователя —
        // от него зависят canContribute / isWalletAgreementSigned, иначе
        // кнопки «Совершить взнос» / «Получить возврат» не появятся до F5.
        await run(true);

        // Свежая загрузка столов и грантов с бэка (DesktopWorkspace.grants):
        // без неё grant-gated кнопки появляются только после F5, когда init-app
        // вызовет loadDesktop. По образцу init-app / EnableButton.
        await desktops.loadDesktop();

        // Ждём, пока статус пайщика догонит цепь.
        //
        // Приём советом доходит до нас двумя путями и с разной задержкой:
        // `participant_account` читается из таблицы цепи и появляется сразу
        // (дельты эмитятся немедленно), а `users.status = active` выставляет
        // слушатель события `soviet::addpartcpnt` — а action-события контроллер
        // эмитит с задержкой в три секунды (`action_emit_delay_ms`).
        //
        // В этом промежутке `isFullyActive` ещё false, и `getDefaultPageRoute`
        // отдаёт `non_authorized_default_route`, равный `signup`. Переход при
        // этом выполняется — на ту же страницу, где пайщик и стоит, и внешне не
        // происходит ничего: галочки зелёные, кабинет не открывается, повторять
        // некому. Так регистрация и вставала намертво.
        await waitForActiveStatus();

        // Теперь выбираем рабочий стол с обновленными данными о роли
        // Передаем ignoreSaved=true чтобы пересчитать на основе новой роли
        desktops.selectDefaultWorkspace(true);
        goToCabinet();

        // Показываем диалог разрешения уведомлений после успешной регистрации
        setTimeout(() => {
          showDialog();
        }, 1000);
      } catch (e) {
        console.error('Ошибка при обновлении данных пользователя:', e);
        // В случае ошибки все равно пытаемся перейти
        desktops.selectDefaultWorkspace(true);
        goToCabinet();

        // Показываем диалог разрешения уведомлений даже при ошибке
        setTimeout(() => {
          showDialog();
        }, 1000);
      }
    }
  },
  { deep: true },
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
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
}
.signup-page__card {
  width: 100%;
}
/* Canon-стайлинг q-stepper внутри AuthCard: убираем собственный фон
   и тень q-stepper'а, чтобы он не «карточка в карточке» на тёмной теме —
   AuthCard уже даёт surface + shadow. */
.signup-page__stepper {
  background: transparent;
  box-shadow: none;
  padding: 0;
}
.signup-page__stepper :deep(.q-stepper__nav) {
  padding: 0;
}
.signup-page__stepper :deep(.q-stepper__step-inner) {
  background: transparent;
}
.signup-page__stepper :deep(.q-stepper__dot:before),
.signup-page__stepper :deep(.q-stepper__dot:after),
.signup-page__stepper :deep(.q-stepper__line:before),
.signup-page__stepper :deep(.q-stepper__line:after) {
  background: var(--p-line);
}
.signup-page__restart {
  margin-top: var(--p-4, 16px);
  text-align: center;
}
.signup-page__closed {
  padding: var(--p-4, 16px) 0;
}
</style>
