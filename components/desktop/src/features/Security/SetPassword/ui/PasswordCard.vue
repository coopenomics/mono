<template lang="pug">
BaseCard(
  title='Пароль для входа',
  subtitle='Удобный вход по паролю вместо ключа доступа.'
)
  template(v-if='showOffer')
    BaseBanner(variant='info')
      | Сейчас вы входите по ключу доступа. Задайте пароль — входить станет проще,
      | а доступ восстанавливается по почте даже при утере ключа.
    .pwd__actions
      BaseButton(variant='primary', @click='open = true')
        template(#icon-left)
          q-icon(name='password', size='18px')
        | Задать пароль

  template(v-else-if='passwordReady')
    .pwd__done
      q-icon.pwd__done-ico(name='check_circle', size='20px')
      span Вход по паролю настроен.
    .pwd__actions
      BaseButton(variant='secondary', @click='changeOpen = true')
        template(#icon-left)
          q-icon(name='password', size='18px')
        | Сменить пароль

  //- Аккаунт ещё грузится — состояние пароля неизвестно, каркас вместо ответа.
  template(v-else)
    q-skeleton(type='text', width='60%')

  //- Смена при известном старом пароле: старый проверяется расшифровкой vault'а,
  //- дальше — конвейер миграции (новый пароль + перевыпуск ключа + отзыв сессий).
  ChangePasswordDialog(v-model='changeOpen')

  BaseDialog(v-model='open', title='Установка пароля', size='sm')
    .pwd__form
      BaseBanner(variant='info')
        | Пароль шифрует ваш ключ доступа. После установки вход в систему —
        | только по email и паролю; текущая сессия продолжит работать.
      BaseInput(
        v-model='password',
        label='Новый пароль',
        type='password',
        autocomplete='new-password',
        :hint='PASSWORD_POLICY_HINT',
        :error='passwordError'
      )
      BaseInput(
        v-model='repeat',
        label='Повторите пароль',
        type='password',
        autocomplete='new-password',
        :error='repeatError'
      )
    template(#footer)
      BaseButton(variant='secondary', @click='open = false') Отмена
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!isValid',
        @click='onSave'
      ) Сохранить пароль
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { PASSWORD_POLICY_HINT } from '@coopenomics/auth';
import { ChangePasswordDialog } from 'src/features/Security/ChangePassword';
import { useNewPasswordForm, useSetPassword } from '../model';

const session = useSessionStore();
const { setPasswordFromScreen } = useSetPassword();

const open = ref(false);
const changeOpen = ref(false);
const { password, repeat, passwordError, repeatError, isValid } = useNewPasswordForm();
const saving = ref(false);

// Признак пароля — серверный (Account.has_password): локальные отметки врали бы
// на других устройствах. CoopID-сессия сама по себе означает вход по паролю.
const hasPassword = computed(() => session.currentUserAccount?.has_password);
const passwordReady = computed(() => session.isCoopIdSession || hasPassword.value === true);
const showOffer = computed(() => !session.isCoopIdSession && hasPassword.value === false);

async function onSave(): Promise<void> {
  if (!isValid.value) return;
  saving.value = true;
  try {
    if (await setPasswordFromScreen(password.value)) open.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.pwd__actions {
  margin-top: var(--p-3);
}
.pwd__form {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.pwd__done {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  color: var(--p-ink-2);
}
.pwd__done-ico {
  color: var(--p-pos);
}
</style>
