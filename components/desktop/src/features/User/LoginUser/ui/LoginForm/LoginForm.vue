<template lang="pug">
form.full-width(@submit.prevent='submit')
  q-input.full-width.q-mt-lg(
    v-model='email',
    label='Введите электронную почту',
    color='primary',
    hint='',
    standout='bg-teal text-white',
    autocorrect='off',
    autocapitalize='off',
    autocomplete='off',
    spellcheck='false'
  )

  q-input.full-width(
    v-model='privateKey',
    label='Введите ключ доступа',
    color='primary',
    hint='',
    standout='bg-teal text-white',
    type='password',
    autocorrect='off',
    autocapitalize='off',
    autocomplete='on',
    spellcheck='false'
  )

  q-btn.full-width(
    type='submit',
    label='Войти',
    color='primary',
    :loading='loading',
    :disable='!privateKey'
  )
</template>
<script lang="ts" setup>
import { useCurrentUser } from 'src/entities/Session';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';
import { FailAlert } from 'src/shared/api';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { LocalStorage } from 'quasar';

const router = useRouter();

const email = ref('');
const privateKey = ref('');
const loading = ref(false);
const currentUser = useCurrentUser();

/**
 * Функция для перехода по сохраненному URL после успешного входа
 */
function navigateToSavedUrl() {
  if (process.env.CLIENT) {
    // Проверяем наличие сохраненного URL для редиректа
    const redirectUrl = LocalStorage.getItem('redirectAfterLogin') as string;
    console.log('login form redirect url', redirectUrl);

    if (redirectUrl) {
      // Удаляем сохраненный URL
      LocalStorage.remove('redirectAfterLogin');

      try {
        // Пытаемся использовать router для навигации
        const url = new URL(redirectUrl);
        const path = url.pathname + url.search;
        console.log('Navigating with router to', path);
        router.push(path);
      } catch (e) {
        console.error('Error parsing URL, using direct navigation', e);
        window.location.href = redirectUrl;
      }

      return true;
    }
  }
  return false;
}

const submit = async () => {
  loading.value = true;

  // Включаем лоадер сразу в начале процесса входа
  const desktops = useDesktopStore();
  desktops.setWorkspaceChanging(true);

  try {
    const { login } = useLoginUser();
    await login(email.value, privateKey.value);

    if (!currentUser.isRegistrationComplete.value) {
      // Если регистрация не завершена, выключаем лоадер и идем на signup
      desktops.setWorkspaceChanging(false);
      router.push({ name: 'signup' });
    } else {
      // Пробуем перейти по сохраненному URL
      if (!navigateToSavedUrl()) {
        // Если сохраненного URL нет, переходим на страницу по умолчанию
        desktops.selectDefaultWorkspace();
        desktops.goToDefaultPage(router);
      }

      // Проверяем, если данные уже загружены, выключаем лоадер
      const session = useSessionStore();
      if (session.loadComplete) {
        desktops.setWorkspaceChanging(false);
      }
      // Иначе лоадер выключится в init-wallet после завершения инициализации
    }

    loading.value = false;
  } catch (e: any) {
    console.error(e);
    loading.value = false;
    // Выключаем лоадер при ошибке
    desktops.setWorkspaceChanging(false);
    FailAlert(e);
  }
};
</script>
