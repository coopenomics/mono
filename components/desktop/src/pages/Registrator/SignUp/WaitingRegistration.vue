<template lang="pug">
div(v-show='store.isStep("WaitingRegistration")')
    //- Совет отказал (declinereg). Возврат идёт в два шага:
    //-  1) PROCESSING — исходящий платёж кассой ещё не проведён: кнопки нет,
    //-     ждём завершения возврата;
    //-  2) REFUNDED — взнос возвращён: только теперь можно подать заявку заново
    //-     (на цепи освобождён аккаунт — refundpay снял карточку участника).
    template(v-if='isCouncilRefundPending')
      BaseBanner.q-mb-md(variant='neg')
        .text-bold {{ $t('registrator.waitingRegistration.declinedTitle') }}
        p.q-mt-xs.q-mb-none(v-if='declineMessage') {{ declineMessage }}
        p.q-mt-xs.q-mb-none(v-else) {{ $t('registrator.waitingRegistration.refundPendingText') }}
      .waiting-pending
        q-icon.waiting-pending__icon(name='hourglass_top', size='40px')
        p.waiting-pending__caption {{ $t('registrator.waitingRegistration.refundInProgressCaption') }}
    template(v-else-if='isCouncilDeclined')
      BaseBanner.q-mb-md(variant='neg')
        .text-bold {{ $t('registrator.waitingRegistration.declinedTitle') }}
        p.q-mt-xs.q-mb-none(v-if='declineMessage') {{ declineMessage }}
        p.q-mt-xs.q-mb-none(v-else) {{ $t('registrator.waitingRegistration.declinedText') }}
      .row.q-gutter-sm
        BaseButton(variant='primary', @click='fixData', :loading='isResetting') {{ $t('registrator.waitingRegistration.reapplySubmit') }}
    //- Платёж отклонён председателем (до создания аккаунта в блокчейне) —
    //- показываем причину и даём начать заново со своим e-mail.
    template(v-else-if='isDeclined')
      BaseBanner.q-mb-md(variant='neg')
        .text-bold {{ $t('registrator.waitingRegistration.paymentRejectedTitle') }}
        p.q-mt-xs.q-mb-none(v-if='declineMessage') {{ $t('registrator.waitingRegistration.declineReason', { reason: declineMessage }) }}
        p.q-mt-xs.q-mb-none(v-else) {{ $t('registrator.waitingRegistration.paymentRejectedText') }}
      .row.q-gutter-sm
        BaseButton(variant='primary', @click='retryPayment', :disable='isResetting') {{ $t('registrator.waitingRegistration.retryPaymentSubmit') }}
        BaseButton(variant='secondary', @click='fixData', :loading='isResetting') {{ $t('registrator.waitingRegistration.fixDataSubmit') }}
    //- Техническая ошибка обработки — направляем в поддержку.
    template(v-else-if='isFailed')
      p {{ $t('registrator.waitingRegistration.failedText') }}
    //- Счёт выставлен, но деньги ещё НЕ поступили (PENDING) — это НЕ «принят».
    //- Возвращаем пайщика к оплате, чтобы он завершил вступительный взнос.
    template(v-else-if='isAwaitingPayment')
      BaseBanner.q-mb-md(variant='info')
        .text-bold {{ $t('registrator.waitingRegistration.awaitingPaymentTitle') }}
        p.q-mt-xs.q-mb-none {{ $t('registrator.waitingRegistration.awaitingPaymentText') }}
      .row.q-gutter-sm
        BaseButton(variant='primary', @click='retryPayment') {{ $t('registrator.waitingRegistration.goToPaymentSubmit') }}
    //- Штатное ожидание: деньги поступили (PAID/COMPLETED), ждём решение совета.
    template(v-else)
      p {{ $t('registrator.waitingRegistration.pendingText') }}
      span {{ $t('registrator.waitingRegistration.pendingHint') }}
      //- Статичная иконка ожидания вместо крутящегося спиннера: процесс длится
      //- до 30 дней, анимация загрузки сбивала с толку («страница не дозагрузилась»).
      .waiting-pending
        q-icon.waiting-pending__icon(name='hourglass_top', size='40px')
        p.waiting-pending__caption {{ $t('registrator.waitingRegistration.pendingCaption') }}
</template>

<script lang="ts" setup>
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useAccountStore } from 'src/entities/Account';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { useRegistratorStore } from 'src/entities/Registrator';
import { Zeus } from '@coopenomics/sdk';
import { useResetRegistration } from 'src/features/Account/ResetRegistration';
import { FailAlert, extractGraphQLErrorMessages } from 'src/shared/api';
import { t } from 'src/shared/i18n';

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

// Счёт выставлен, но деньги ещё не поступили (PENDING). Это НЕ «платёж принят»:
// строку счёта создаём сразу при заходе на шаг оплаты, она не подтверждает
// поступление средств. Показываем «ожидаем оплату» + кнопку возврата к оплате.
const isAwaitingPayment = computed(
  () => registrationPayment.value?.status === Zeus.PaymentStatus.PENDING
);

const declineMessage = computed(() => registrationPayment.value?.message || '');

// Отказ совета (declinereg) — два шага возврата, бэкенд отдаёт их по
// registration_payment.status (входящий рег-платёж эти статусы не принимает):
//  • PROCESSING — исходящий возврат кассой ещё не проведён: ждём, кнопки нет;
//  • REFUNDED  — взнос возвращён, аккаунт на цепи освобождён: можно подать заявку
//    заново. Раньше REFUNDED показывать кнопку нельзя — повторный reguser упадёт.
const isCouncilRefundPending = computed(
  () => registrationPayment.value?.status === Zeus.PaymentStatus.PROCESSING
);
const isCouncilDeclined = computed(
  () => registrationPayment.value?.status === Zeus.PaymentStatus.REFUNDED
);

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
    // Сбрасываем все согласия и подписанные документы — на повторном проходе
    // пайщик должен заново проставить галочки (устав/ПД) и подписать заявление.
    store.resetConsents();
    store.goTo('SetUserData');
  } catch (e: any) {
    FailAlert(t('registrator.waitingRegistration.editReturnError', { error: extractGraphQLErrorMessages(e) }));
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

// Совет принял, пока пайщик смотрел на экран ожидания.
//
// Раньше переход на следующий шаг стоял только в `onMounted`, то есть срабатывал
// исключительно при заходе на уже принятую заявку. Когда решение приходило при
// открытой странице — а это обычный случай, ради него и заведён опрос, — шаг не
// двигался: опрос обновлял аккаунт, галочки становились зелёными, и всё на этом
// заканчивалось. Смотрим за самой записью пайщика, а не за моментом монтирования.
watch(participantAccount, (account) => {
  if (account && step.value === currentStep) {
    if (interval.value) clearInterval(interval.value);
    store.next();
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

<style scoped>
.waiting-pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2, 8px);
  margin-top: var(--p-5, 24px);
}
.waiting-pending__icon {
  color: var(--p-ink-3, var(--p-ink-2));
}
.waiting-pending__caption {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3, var(--p-ink-2));
}
</style>
