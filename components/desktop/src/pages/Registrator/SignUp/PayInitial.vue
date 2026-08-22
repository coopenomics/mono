<template lang="pug">
q-step(
  :name='store.steps.PayInitial',
  title='Оплатите вступительный взнос',
  :done='store.isStepDone("PayInitial")'
)

  Loader(v-if="isCreatingPayment" text="готовим данные для приёма взносов")
  div(v-else-if='payment?.payment_details?.amount_without_fee').q-pa-sm
    p Пожалуйста, совершите оплату регистрационного взноса {{ payment.payment_details.amount_without_fee }}. Комиссия провайдера {{ payment.payment_details.fact_fee_percent }}%, всего к оплате: {{ payment.payment_details.amount_plus_fee }}.
    .q-mt-md
      span.text-bold Внимание!
      span.q-ml-xs Оплату необходимо произвести с банковского счета пайщика, который вступает в кооператив. При поступлении средств с другого счета, оплата будет аннулирована, а вступление в кооператив приостановлено.
    PayWithProvider(
      v-if='payment',
      :payment-order='payment',
      @payment-fail='paymentFail',
      @payment-success='paymentSuccess'
    )
</template>

<script lang="ts" setup>
import { computed, watch, ref, onBeforeUnmount } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
const { info } = useSystemStore();

import { useCooperativeStore } from 'src/entities/Cooperative';
import { useRegistratorStore } from 'src/entities/Registrator';
import { useSessionStore } from 'src/entities/Session';
import { useAccountStore } from 'src/entities/Account';
import { PayWithProvider } from 'src/shared/ui/PayWithProvider';
import { Loader } from 'src/shared/ui/Loader';
import { Zeus } from '@coopenomics/sdk';

const store = useRegistratorStore();
const api = useCreateUser();
const session = useSessionStore();
const accountStore = useAccountStore();

const step = computed(() => store.state.step);
const coop = useCooperativeStore();
const isCreatingPayment = ref(false);

// Поллинг приёма оплаты. Провайдер QR (Bank) не эмитит success-колбэк, а деньги
// подтверждаются вебхуком на бэке асинхронно — без поллинга экран висит на форме
// оплаты до перезагрузки. Каждые 10с подтягиваем аккаунт; как только вступительный
// платёж покинул статус PENDING (принят/отклонён) — уходим на шаг ожидания решения
// совета, который сам показывает «платёж принят» либо причину отказа.
const pollInterval = ref();

const POLL_TERMINAL_STATUSES = [
  Zeus.PaymentStatus.PAID,
  Zeus.PaymentStatus.COMPLETED,
  Zeus.PaymentStatus.CANCELLED,
  Zeus.PaymentStatus.EXPIRED,
  Zeus.PaymentStatus.FAILED,
];

const pollPaymentStatus = async () => {
  if (!session.username) return;
  try {
    const account = await accountStore.getAccount(session.username);
    session.setCurrentUserAccount(account);
    const status = session.registrationPayment?.status;
    if (status && POLL_TERMINAL_STATUSES.includes(status)) {
      clearInterval(pollInterval.value);
      store.goTo('WaitingRegistration');
    }
  } catch (e) {
    console.error('Ошибка опроса статуса оплаты:', e);
  }
};

// Computed property для payment с правильной типизацией
const payment = computed(() => store.state.payment);

const currentStep = store.steps.PayInitial;

// Загружаем данные кооператива один раз при инициализации
coop.loadPublicCooperativeData(info.coopname);

const createInitialPayment = async () => {
  // Защита от повторных вызовов
  if (isCreatingPayment.value || store.state.is_paid) return;

  try {
    isCreatingPayment.value = true;
    store.state.inLoading = true;
    await api.createInitialPayment();
  } catch (e: any) {
    FailAlert(
      'Возникла ошибка на этапе оплаты. Попробуйте позже или обратитесь в поддержку.',
    );
    console.error(e);
  } finally {
    isCreatingPayment.value = false;
    store.state.inLoading = false;
  }
};

// Используем только watch с immediate: true вместо onMounted + watch
watch(step, (newValue) => {
  if (newValue === currentStep) {
    createInitialPayment();
    clearInterval(pollInterval.value);
    pollInterval.value = setInterval(() => pollPaymentStatus(), 10000);
  } else {
    clearInterval(pollInterval.value);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  clearInterval(pollInterval.value);
});

watch(
  () => store.state.is_paid,
  (newValue) => {
    if (newValue === true) {
      store.state.agreements.self_paid = true;
      store.next();
    }
  },
);

const paymentFail = (): void => {
  FailAlert(
    'Возникла ошибка на этапе оплаты. Попробуйте позже или обратитесь в поддержку.',
  );
};

const paymentSuccess = (): void => {
  store.state.is_paid = true;
};
</script>
