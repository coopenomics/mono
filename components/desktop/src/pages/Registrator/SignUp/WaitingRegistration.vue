<template lang="pug">
div
  q-step(
    :name='store.steps.WaitingRegistration',
    :title='isDeclined ? "Платёж не принят" : "Получите решение совета о приёме Вас в пайщики кооператива"',
    :done='store.isStepDone("WaitingRegistration")'
  )
    //- Платёж отклонён председателем (до создания аккаунта в блокчейне) —
    //- показываем причину и даём начать заново со своим e-mail.
    template(v-if='isDeclined')
      BaseBanner.q-mb-md(variant='neg')
        .text-bold Ваш платёж не был принят.
        p.q-mt-xs.q-mb-none(v-if='declineMessage') Причина: {{ declineMessage }}
        p.q-mt-xs.q-mb-none(v-else) Председатель отклонил поступление взноса. Вы можете повторить оплату или поправить данные и подать заявку снова.
      .row.q-gutter-sm
        BaseButton(variant='primary', @click='retryPayment', :disable='isResetting') Повторить оплату
        BaseButton(variant='secondary', @click='fixData', :loading='isResetting') Исправить данные
    //- Техническая ошибка обработки — направляем в поддержку.
    template(v-else-if='isFailed')
      p Произошла ошибка при регистрации. Пожалуйста, обратитесь в поддержку для устранения проблемы.
    //- Штатное ожидание: деньги приняты, ждём решение совета.
    template(v-else)
      p Ваш платеж принят. Ожидаем, когда совет рассмотрит Ваше заявление и примет решение о приёме Вас в пайщики. Рассмотрение может занять до 30 дней, но обычно решение принимается в течение одного-двух дней. Вы получите уведомление, когда решение будет принято.
      span Эту страницу можно закрыть, а при необходимости, войти с другого устройства с помощью ключа доступа, который был сохранён ранее.
      Loader
</template>

<script lang="ts" setup>
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useAccountStore } from 'src/entities/Account';
import { Loader } from 'src/shared/ui/Loader';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { useRegistratorStore } from 'src/entities/Registrator';
import { Zeus } from '@coopenomics/sdk';
import { useResetRegistration } from 'src/features/Account/ResetRegistration';
import { FailAlert } from 'src/shared/api';

const store = useRegistratorStore();
const session = useSessionStore();
const accountStore = useAccountStore();
const { resetRegistration } = useResetRegistration();
const isResetting = ref(false);

const currentStep = store.steps.WaitingRegistration;
const step = computed(() => store.state.step);
const interval = ref();

const participantAccount = computed(() => session.participantAccount);
const registrationPayment = computed(() => session.registrationPayment);

// Статусы регистрационного платежа, при которых регистрацию нельзя продолжить
// и пайщику нужно начать заново (отклонение/истечение/сбой провайдера).
const isDeclined = computed(() => {
  const status = registrationPayment.value?.status;
  return (
    status === Zeus.PaymentStatus.CANCELLED ||
    status === Zeus.PaymentStatus.EXPIRED ||
    status === Zeus.PaymentStatus.FAILED
  );
});

const declineMessage = computed(() => registrationPayment.value?.message || '');

// Унаследованная ветка технической ошибки по блокчейн-аккаунту пользователя.
const isFailed = computed(() => session.userAccount?.status === 'failed' && !isDeclined.value);

const retryPayment = () => {
  store.state.is_paid = false;
  store.state.payment = null;
  store.goTo('PayInitial');
};

// «Исправить данные» = откат регистрации на бэкенде: после подписи заявления
// профиль и e-mail заморожены (users.status=joined), локального возврата мало —
// сервер снимает заморозку, сбрасывает заявление и непринятый платёж. Только
// после этого возвращаем пайщика к редактированию данных.
const fixData = async () => {
  isResetting.value = true;
  try {
    const account = await resetRegistration();
    session.setCurrentUserAccount(account);
    store.state.is_paid = false;
    store.state.payment = null;
    store.state.signature = '';
    store.goTo('SetUserData');
  } catch (e: any) {
    FailAlert(`Не удалось вернуться к редактированию: ${e.message}`);
  } finally {
    isResetting.value = false;
  }
};

// Опрос аккаунта: пока пайщик ждёт, подтягиваем актуальный статус платежа и
// участника, чтобы экран ожидания сам переключился на «отклонено» или «принят».
const update = async () => {
  if (!session.username || participantAccount.value) {
    clearInterval(interval.value);
    return;
  }
  try {
    const account = await accountStore.getAccount(session.username);
    session.setCurrentUserAccount(account);
  } catch (e) {
    console.error('Ошибка обновления статуса регистрации:', e);
  }
};

watch(step, (newValue) => {
  if (newValue === currentStep) {
    interval.value = setInterval(() => update(), 10000);
    update();
  } else if (interval.value) {
    clearInterval(interval.value);
  }
});

onMounted(() => {
  if (participantAccount.value && step.value === currentStep) store.next();
});

onBeforeUnmount(() => {
  if (interval.value) {
    clearInterval(interval.value);
  }
});
</script>
