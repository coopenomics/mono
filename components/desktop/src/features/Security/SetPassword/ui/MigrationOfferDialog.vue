<template lang="pug">
//- Мягкая миграция «ключ → пароль»: небольшой ЗАКРЫВАЕМЫЙ диалог при загрузке
//- рабочего стола для пайщика, вошедшего по ключу и ещё без пароля. Не блокирует
//- работу: «Позже» (или крестик) убирает его до следующей перезагрузки страницы.
//- :close-on-route-change='false' обязателен: диалог поднимается во время
//- загрузки, и стартовый редирект на дефолтный стол иначе закрывает его молча,
//- а закрытие трактуется как «Позже» — пайщик оффера просто не увидит.
BaseDialog(
  v-model='visible',
  title='Удостоверение пайщика',
  size='sm',
  :close-on-route-change='false'
)
  .migration-offer(v-if='step === "intro"')
    BaseBanner(variant='info')
      | Здравствуйте! Система вводит удостоверение пайщика — вход по email и паролю.
    p.migration-offer__text
      | Чтобы получить удостоверение, задайте пароль. После этого приватный ключ
      | больше не понадобится: вы будете входить в систему только по почте и паролю.
      | Установка займёт меньше минуты, выходить из системы не придётся.

  .migration-offer(v-else)
    BaseInput(
      v-model='password',
      label='Новый пароль',
      type='password',
      autocomplete='new-password',
      :hint='PASSWORD_POLICY_HINT',
      :error='passwordError',
      autofocus
    )
    BaseInput(
      v-model='repeat',
      label='Повторите пароль',
      type='password',
      autocomplete='new-password',
      :error='repeatError'
    )

  template(#footer)
    template(v-if='step === "intro"')
      BaseButton(variant='secondary', @click='postpone') Позже
      BaseButton(variant='primary', @click='step = "form"')
        template(#icon-left)
          q-icon(name='password', size='18px')
        | Установить пароль
    template(v-else)
      BaseButton(variant='secondary', :disabled='saving', @click='step = "intro"') Назад
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!isValid',
        @click='onSetPassword'
      ) Установить
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { PASSWORD_POLICY_HINT } from '@coopenomics/auth';
import { BaseBanner, BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import {
  migrationOfferDismissed as dismissed,
  useNewPasswordForm,
  useSetPassword,
} from '../model';

const session = useSessionStore();
const { setPassword } = useSetPassword();

const step = ref<'intro' | 'form'>('intro');
const saving = ref(false);
const { password, repeat, passwordError, repeatError, isValid, reset } = useNewPasswordForm();

// Показ — по серверному признаку (Account.has_password), только принятым
// пайщикам (кандидат в потоке регистрации живёт по своим правилам) и только в
// легаси-сессии: CoopID-сессия и означает вход по паролю. loadComplete — чтобы
// не подниматься посреди инициализации и стартовых редиректов кабинета.
const shouldShow = computed(
  () =>
    session.isAuth &&
    session.loadComplete &&
    !session.isCoopIdSession &&
    session.isRegistrationComplete &&
    session.currentUserAccount?.has_password === false,
);

const visible = computed({
  get: () => shouldShow.value && !dismissed.value,
  // Любое закрытие (крестик, backdrop, Escape) = «Позже».
  set: (v: boolean) => {
    if (!v) dismissed.value = true;
  },
});

function postpone(): void {
  dismissed.value = true;
}

async function onSetPassword(): Promise<void> {
  if (!isValid.value || saving.value) return;
  saving.value = true;
  try {
    await setPassword(password.value);
    dismissed.value = true;
    reset();
    SuccessAlert('Пароль установлен — вы уже вошли по нему, работайте дальше.');
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.migration-offer {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.migration-offer__text {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
</style>
