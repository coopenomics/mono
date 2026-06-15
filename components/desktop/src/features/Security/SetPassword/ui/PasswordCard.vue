<template lang="pug">
BaseCard(
  title='Пароль для входа',
  subtitle='Удобный вход по паролю вместо ключа доступа.'
)
  template(v-if='showOffer')
    BaseBanner(variant='info')
      | Сейчас вы входите по ключу доступа. Задайте пароль — входить станет проще,
      | а ключ останется запасным способом восстановления.
    .pwd__actions
      BaseButton(variant='primary', @click='open = true')
        template(#icon-left)
          q-icon(name='password', size='18px')
        | Задать пароль

  .pwd__done(v-else)
    q-icon.pwd__done-ico(name='check_circle', size='20px')
    span Вход по паролю настроен.

  BaseDialog(v-model='open', title='Установка пароля', size='sm')
    .pwd__form
      BaseBanner(variant='info')
        | Пароль шифрует ваш ключ доступа. Запишите его отдельно — без пароля и без
        | ключа доступ восстанавливается только через процедуру восстановления.
      BaseInput(
        v-model='password',
        label='Новый пароль',
        type='password',
        autocomplete='new-password',
        :hint='`Минимум ${MIN_PASSWORD_LENGTH} символов`',
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
import { LocalStorage } from 'quasar';
import { BaseBanner, BaseButton, BaseCard, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useGlobalStore } from 'src/shared/store';
import { useSetPassword } from '../model';

const MIN_PASSWORD_LENGTH = 8;

const session = useSessionStore();
const globalStore = useGlobalStore();
const { setPassword } = useSetPassword();

const open = ref(false);
const password = ref('');
const repeat = ref('');
const saving = ref(false);
const justMigrated = ref(false);

const email = computed(() => session.providerAccount?.email ?? '');
const alreadyMigrated = computed(
  () => justMigrated.value || LocalStorage.getItem(`coopid:migrated:${email.value}`) === true,
);
// Предлагаем пароль только тем, кто вошёл по ключу (легаси) и ещё не мигрировал.
const showOffer = computed(
  () => !!globalStore.username && !session.isCoopIdSession && !alreadyMigrated.value,
);

const isValidPassword = computed(() => password.value.length >= MIN_PASSWORD_LENGTH);
const passwordsMatch = computed(() => !!repeat.value && repeat.value === password.value);
const passwordError = computed(() =>
  password.value && !isValidPassword.value ? `Минимум ${MIN_PASSWORD_LENGTH} символов` : '',
);
const repeatError = computed(() =>
  repeat.value && !passwordsMatch.value ? 'Пароли не совпадают' : '',
);
const isValid = computed(() => isValidPassword.value && passwordsMatch.value);

async function onSave(): Promise<void> {
  if (!isValid.value) return;
  saving.value = true;
  try {
    await setPassword(password.value);
    justMigrated.value = true;
    SuccessAlert('Пароль установлен. В следующий раз войдите по паролю.');
    open.value = false;
  } catch (e) {
    FailAlert(e);
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
