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
    .migration-offer__hero
      q-icon(name='verified_user', size='28px')
    p.migration-offer__lead
      | Кооператив переходит на новую систему идентификации —
      | цифровое удостоверение пайщика.
    ul.migration-offer__points
      li
        q-icon(name='lock', size='18px')
        span
          | Для защиты ваших средств, документов и персональных данных
          | рекомендуем установить пароль: вход в систему будет по email и паролю.
      li
        q-icon(name='key_off', size='18px')
        span
          | Ключ доступа, выданный при регистрации, после установки пароля
          | больше не потребуется.
      li
        q-icon(name='schedule', size='18px')
        span
          | Установка займёт меньше минуты — выходить из системы не придётся.

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
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
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
  gap: var(--p-4);
}

/* Иконка-«герб» удостоверения: мягкий круг в акцентном тоне, по центру. */
.migration-offer__hero {
  align-self: center;
  width: 56px;
  height: 56px;
  border-radius: var(--p-r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.migration-offer__lead {
  margin: 0;
  text-align: center;
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  font-weight: 600;
  color: var(--p-ink);
}

.migration-offer__points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.migration-offer__points li {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.migration-offer__points li .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--p-ink-3);
}
</style>
