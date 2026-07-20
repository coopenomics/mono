<template>
  <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
    <BaseInput
      v-model="email"
      label="Электронная почта"
      type="email"
      autocomplete="email"
      required
    />
    <BaseInput
      v-model="privateKey"
      label="Ключ доступа"
      type="password"
      autocomplete="current-password"
      required
    />
    <BaseButton
      type="submit"
      variant="primary"
      block
      :loading="loading"
      :disabled="!privateKey"
    >
      Войти
    </BaseButton>
  </BaseForm>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LocalStorage } from 'quasar';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';
import { useNotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { updateOpenReplayUser } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';

const router = useRouter();
const system = useSystemStore();
const session = useSessionStore();
const { showDialog } = useNotificationPermissionDialog();

const email = ref('');
const privateKey = ref('');
const loading = ref(false);
const errorMessage = ref('');

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

const submit = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = '';
  const desktops = useDesktopStore();
  desktops.setWorkspaceChanging(true);

  try {
    const { login } = useLoginUser();
    await login(email.value, privateKey.value);

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

      // Свежая загрузка столов и грантов под уже авторизованного пользователя.
      // Вход в той же вкладке (без перезагрузки) НЕ переинициализирует приложение,
      // поэтому currentDesktop остаётся АНОНИМНЫМ — целевой стол (напр.
      // chairman/connect) резолвится, но рендерится пустым до ручного F5.
      // loadDesktop() подтягивает DesktopWorkspace.grants актуального пользователя.
      // По образцу SignUp.vue / init-app / EnableButton. Best-effort: сбой загрузки
      // стола не должен ронять уже успешный вход.
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
  } catch (e: any) {
    console.error(e);
    loading.value = false;
    desktops.setWorkspaceChanging(false);
    errorMessage.value = e?.message || 'Не удалось выполнить вход. Проверьте email и ключ доступа.';
    FailAlert(e);
  }
};
</script>
