<template lang="pug">
//- Призыв подтвердить почту: небольшой ЗАКРЫВАЕМЫЙ диалог при загрузке рабочего
//- стола пайщику с неподтверждённым адресом. Не блокирует работу — «Позже» (или
//- крестик) убирает его до следующей перезагрузки страницы.
//- :close-on-route-change='false' обязателен: диалог поднимается во время
//- загрузки кабинета, и стартовый редирект на дефолтный стол иначе закрыл бы его
//- молча, а закрытие трактуется как «Позже» — пайщик призыва просто не увидит.
BaseDialog(
  v-model='visible',
  title='Подтвердите электронную почту',
  size='sm',
  :close-on-route-change='false'
)
  .verify-offer
    p.verify-offer__text
      | Подтверждение нужно, чтобы вы могли вернуть доступ к кабинету, если
      | забудете пароль, и получать уведомления кооператива.

    template(v-if='started')
      EmailCodeForm(:email='email', @verified='onVerified')
    template(v-else)
      p.verify-offer__text.verify-offer__text--muted
        | Код придёт на адрес
        |
        strong {{ email }}

  template(#footer)
    BaseButton(variant='secondary', @click='postpone') Позже
    BaseButton(v-if='!started', variant='primary', @click='started = true')
      template(#icon-left)
        q-icon(name='mark_email_read', size='18px')
      | Выслать код
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { loadUserContext } from 'src/processes/init-wallet/loadUserContext';
import { useAccountEmail, verifyEmailOfferDismissed as dismissed } from '../model';
import EmailCodeForm from './EmailCodeForm.vue';

const session = useSessionStore();
const { email, isVerified } = useAccountEmail();

/** Пайщик согласился подтверждать — форма сама вышлет код при появлении. */
const started = ref(false);

// Показываем только принятому пайщику с уже настроенным входом: кандидат в
// потоке регистрации живёт по своим правилам (там почта подтверждается на
// первом же шаге), а тому, у кого ещё нет пароля, сперва предлагают пароль
// (`core:migration-offer`) — два призыва подряд превратились бы в очередь
// диалогов. loadComplete — чтобы не подниматься посреди инициализации и
// стартовых редиректов кабинета.
const shouldShow = computed(
  () =>
    session.isAuth &&
    session.loadComplete &&
    session.isRegistrationComplete &&
    (session.isCoopIdSession || session.currentUserAccount?.has_password === true) &&
    !!email.value &&
    !isVerified.value,
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

async function onVerified(): Promise<void> {
  dismissed.value = true;
  SuccessAlert('Электронная почта подтверждена');
  try {
    await loadUserContext();
  } catch (e) {
    console.warn('[VERIFY-EMAIL] не удалось обновить аккаунт после подтверждения', e);
  }
}
</script>

<style scoped>
.verify-offer {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.verify-offer__text {
  margin: 0;
}
.verify-offer__text--muted {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
</style>
