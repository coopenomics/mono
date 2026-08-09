<template>
  <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
    <BaseInput
      v-model="email"
      label="Электронная почта"
      type="email"
      autocomplete="email"
      required
    />

    <!-- Шаг входа: единое поле — пароль или ключ доступа -->
    <template v-if="mode === 'login'">
      <BaseInput
        v-model="secret"
        label="Пароль или ключ доступа"
        type="password"
        autocomplete="current-password"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!secret || !email"
      >
        Войти
      </BaseButton>
    </template>

    <!-- Шаг миграции: вошли по ключу — предлагаем задать пароль -->
    <template v-else>
      <BaseBanner variant="info">
        Придумайте пароль. Ваш ключ доступа будет зашифрован им и сохранён на
        сервере — держать его у себя больше не нужно. Дальше вход в кооператив
        только по паролю.
      </BaseBanner>
      <BaseInput
        v-model="newPassword"
        label="Новый пароль"
        type="password"
        autocomplete="new-password"
        :hint="`Минимум ${MIN_PASSWORD_LENGTH} символов`"
        :error="passwordError"
        required
      />
      <BaseInput
        v-model="repeatPassword"
        label="Повторите пароль"
        type="password"
        autocomplete="new-password"
        :error="repeatError"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!canMigrate"
      >
        Задать пароль и войти
      </BaseButton>
    </template>
  </BaseForm>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { LocalStorage } from 'quasar';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';
import { useNotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';
import { FailAlert } from 'src/shared/api';
import { BaseBanner, BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { env, updateOpenReplayUser } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';
import { looksLikeWif } from 'src/shared/lib/utils/looksLikeWif';
import { warmUpAuthentik } from '@coopenomics/auth';

const MIN_PASSWORD_LENGTH = 8;

const router = useRouter();
const system = useSystemStore();
const session = useSessionStore();
const { showDialog } = useNotificationPermissionDialog();
const { migrateAndLogin, loginWithPassword } = useLoginUser();

const email = ref('');
const secret = ref('');
const mode = ref<'login' | 'migrate'>('login');
const newPassword = ref('');
const repeatPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');

// Пока пайщик заполняет форму, открываем flow authentik и тянем метаданные OIDC.
// Оба запроса всё равно нужны при входе, но первое обращение к authentik заметно
// медленнее последующих — выполненные заранее, они уходят из времени ожидания.
onMounted(() => {
  if (env.COOPID_ISSUER) void warmUpAuthentik({ issuer: env.COOPID_ISSUER });
});

const passwordError = computed(() =>
  newPassword.value && newPassword.value.length < MIN_PASSWORD_LENGTH
    ? `Минимум ${MIN_PASSWORD_LENGTH} символов`
    : '',
);
const repeatError = computed(() =>
  repeatPassword.value && repeatPassword.value !== newPassword.value
    ? 'Пароли не совпадают'
    : '',
);
const canMigrate = computed(
  () =>
    newPassword.value.length >= MIN_PASSWORD_LENGTH &&
    repeatPassword.value === newPassword.value,
);

function navigateToSavedUrl(): boolean {
  if (!process.env.CLIENT) return false;
  const redirectUrl = LocalStorage.getItem('redirectAfterLogin') as string;
  if (!redirectUrl) return false;
  LocalStorage.remove('redirectAfterLogin');
  try {
    if (redirectUrl.startsWith('#')) {
      void router.push(redirectUrl.substring(1));
    } else {
      const url = new URL(redirectUrl);
      void router.push(url.pathname + url.search);
    }
  } catch (e) {
    console.error('Error parsing URL, using direct navigation', e);
    window.location.href = redirectUrl;
  }
  return true;
}

/** Общий пост-логин: трекер, переход к регистрации/дашборду, диалог уведомлений. */
async function finishLogin(): Promise<void> {
  const desktops = useDesktopStore();
  updateOpenReplayUser({
    username: session.username,
    coopname: system.info.coopname,
    cooperativeDisplayName: system.cooperativeDisplayName,
  });

  if (!session.isRegistrationComplete) {
    desktops.setWorkspaceChanging(false);
    void router.push({ name: 'signup' });
  } else {
    let attempts = 0;
    const maxAttempts = 50;
    while (!session.loadComplete && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    try {
      await desktops.loadDesktop();
    } catch (e) {
      console.warn('[BOOTRACE] не удалось перезагрузить стол после входа:', e);
    }
    if (!navigateToSavedUrl()) {
      desktops.selectDefaultWorkspace(true);
      desktops.goToDefaultPage(router);
    }
    if (session.loadComplete) {
      desktops.setWorkspaceChanging(false);
    }
  }

  loading.value = false;
  setTimeout(() => {
    showDialog();
  }, 1000);
}

const submit = async (): Promise<void> => {
  errorMessage.value = '';

  // Шаг миграции: задать пароль действующему пайщику и войти.
  if (mode.value === 'migrate') {
    if (!canMigrate.value) return;
    await runLogin(async () => {
      await migrateAndLogin({
        email: email.value,
        privateKey: secret.value,
        newPassword: newPassword.value,
      });
    });
    return;
  }

  // Шаг входа.
  if (!secret.value || !email.value) return;

  // Вставлен ключ доступа — значит пароля у пайщика ещё нет. Ведём на установку
  // пароля БЕЗ возможности пропустить: вход по одному ключу мы больше не даём,
  // иначе переход растянулся бы навсегда и пришлось бы вечно тянуть два контура.
  if (looksLikeWif(secret.value)) {
    mode.value = 'migrate';
    return;
  }

  await runLogin(async () => {
    await loginWithPassword(email.value, secret.value);
  });
};

/** Обёртка входа: общий loading/ошибки + смена столов + пост-логин. */
async function runLogin(action: () => Promise<void>): Promise<void> {
  loading.value = true;
  const desktops = useDesktopStore();
  desktops.setWorkspaceChanging(true);
  try {
    await action();
    await finishLogin();
  } catch (e: any) {
    console.error(e);
    loading.value = false;
    desktops.setWorkspaceChanging(false);
    errorMessage.value =
      e?.message || 'Не удалось выполнить вход. Проверьте данные и попробуйте снова.';
    FailAlert(e);
  }
}
</script>
