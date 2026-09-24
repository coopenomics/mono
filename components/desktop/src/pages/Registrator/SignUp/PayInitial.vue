<template lang="pug">
div(v-show='store.isStep("PayInitial")')

  Loader(v-if="isCreatingPayment" :text="$t('registrator.payInitial.preparingText')")
  div(v-else-if='payment?.payment_details?.amount_without_fee').q-pa-sm
    p {{ $t('registrator.payInitial.paymentInstructions', { amountWithoutFee: payment.payment_details.amount_without_fee, feePercent: payment.payment_details.fact_fee_percent, amountWithFee: payment.payment_details.amount_plus_fee }) }}
    .q-mt-md
      span.text-bold {{ $t('registrator.payInitial.attentionLabel') }}
      span.q-ml-xs {{ $t('registrator.payInitial.attentionText') }}
    PayWithProvider(
      v-if='payment',
      :payment-order='payment',
      @payment-fail='paymentFail',
      @payment-success='paymentSuccess'
    )
</template>

<script lang="ts" setup>
import { computed, watch, ref } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useCreateUser } from 'src/features/User/CreateUser';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
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

// Приём оплаты. Провайдер QR (Bank) не эмитит success-колбэк, а деньги
// подтверждаются вебхуком на бэке асинхронно. Запись платежа приходит пайщику
// сигналом ленты изменений — подтягиваем аккаунт; как только вступительный
// платёж покинул статус PENDING (принят/отклонён) — уходим на шаг ожидания
// решения совета, который сам показывает «платёж принят» либо причину отказа.

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
      store.goTo('WaitingRegistration');
    }
  } catch (e) {
    console.error('Ошибка опроса статуса оплаты:', e);
  }
};

// Computed property для payment с правильной типизацией
const payment = computed(() => store.state.payment);

const currentStep = store.steps.PayInitial;

// Загружаем данные кооператива один раз при инициализации.
//
// Без ожидания и без перехвата отказ уходил необработанным: 08.09.2026 во время
// перезапуска узла страница регистрации пересоздавалась по кругу, и один
// браузер за минуту отправил в журнал ошибок 558 одинаковых «Failed to fetch».
// Реквизиты здесь справочные — не загрузились сейчас, подтянутся при следующем
// открытии шага.
coop.loadPublicCooperativeData(info.coopname).catch((e) => {
  console.warn('Не удалось загрузить данные кооператива:', e);
});

const createInitialPayment = async () => {
  // Защита от повторных вызовов
  if (isCreatingPayment.value || store.state.is_paid) return;

  try {
    isCreatingPayment.value = true;
    store.state.inLoading = true;
    await api.createInitialPayment();
  } catch (e: any) {
    FailAlert(
      t('registrator.payInitial.paymentError'),
    );
    console.error(e);
  } finally {
    isCreatingPayment.value = false;
    store.state.inLoading = false;
  }
};

// Используем только watch с immediate: true вместо onMounted + watch
watch(step, (newValue) => {
  if (newValue === currentStep) createInitialPayment();
}, { immediate: true });

useLiveReload(
  [
    { code: 'core', table: 'payments' },
    { code: 'core', table: 'users' },
  ],
  () => (step.value === currentStep ? pollPaymentStatus() : undefined),
);

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
    t('registrator.payInitial.paymentError'),
  );
};

const paymentSuccess = (): void => {
  store.state.is_paid = true;
};
</script>
