<template lang="pug">
.signup-page
  AuthCard.signup-page__card(:max-width='720', title='Вступить в пайщики')
    q-stepper.signup-page__stepper(
      v-model='store.step',
      vertical,
      animated,
      flat,
      done-color='primary'
    )
      EmailInput

      SetUserData

      SelectProgram

      GenerateAccount

      SelectBranch(v-if='isBranched')

      ReadStatement

      SignStatement

      PayInitial

      WaitingRegistration

  .signup-page__restart
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

import { useRegistratorStore } from 'src/entities/Registrator';
import { useLogoutUser } from 'src/features/User/Logout';
import { useSessionStore } from 'src/entities/Session';
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
const { state, clearUserData, steps } = useRegistratorStore();
const store = state;
const agreementer = useAgreementStore();
const desktops = useDesktopStore();
const system = useSystemStore();
const { info } = system;

// Диалог разрешения уведомлений
const { showDialog } = useNotificationPermissionDialog();

onMounted(() => {
  agreementer.loadCooperativeAgreements(info.coopname);
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
  }
});

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

        // Теперь выбираем рабочий стол с обновленными данными о роли
        // Передаем ignoreSaved=true чтобы пересчитать на основе новой роли
        desktops.selectDefaultWorkspace(true);
        desktops.goToDefaultPage(router);

        // Показываем диалог разрешения уведомлений после успешной регистрации
        setTimeout(() => {
          showDialog();
        }, 1000);
      } catch (e) {
        console.error('Ошибка при обновлении данных пользователя:', e);
        // В случае ошибки все равно пытаемся перейти
        desktops.selectDefaultWorkspace(true);
        desktops.goToDefaultPage(router);

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

const registeredAndloggedIn = computed(() => {
  return (
    session.isRegistrationComplete &&
    session.isAuth &&
    store.step == steps.EmailInput
  );
});

watch(
  () => registeredAndloggedIn,
  async (newValue) => {
    if (newValue.value === true) {
      // Обновляем username в OpenReplay tracker при завершении регистрации и логине
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

        // Теперь выбираем рабочий стол с обновленными данными о роли
        // Передаем ignoreSaved=true чтобы пересчитать на основе новой роли
        desktops.selectDefaultWorkspace(true);
        desktops.goToDefaultPage(router);

        // Показываем диалог разрешения уведомлений после успешной регистрации
        setTimeout(() => {
          showDialog();
        }, 1000);
      } catch (e) {
        console.error('Ошибка при обновлении данных пользователя:', e);
        // В случае ошибки все равно пытаемся перейти
        desktops.selectDefaultWorkspace(true);
        desktops.goToDefaultPage(router);

        // Показываем диалог разрешения уведомлений даже при ошибке
        setTimeout(() => {
          showDialog();
        }, 1000);
      }
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
</style>
