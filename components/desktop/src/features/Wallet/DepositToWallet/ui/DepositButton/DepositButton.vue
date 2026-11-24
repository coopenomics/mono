<template lang="pug">
q-btn(
  v-if='canContribute',
  @click='openDialog',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :outline='Boolean(label) && !primary',
  :no-caps='Boolean(label)',
  :dense='micro',
  :size='micro || (label && !primary) ? "sm" : undefined'
)
  //- С подписью кнопка стоит внутри чужой формы (например, запись на курс) и называет действие словами.
  span(v-if='label') {{ label }}
  template(v-else)
    q-icon(:name='micro ? "fa-solid fa-arrow-up" : "fa-solid fa-chevron-up"')
    span(v-if='!micro').q-ml-sm {{ $t('wallet.depositButton.buttonLabel') }}
  q-tooltip(v-if='micro') {{ $t('wallet.depositButton.submitLabel') }}

  BaseDialog(
    v-if='!paymentOrder',
    v-model='showDialog',
    :title='$t("wallet.depositButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form(
      :handler-submit='handlerSubmit',
      :is-submitting='isSubmitting',
      :button-cancel-txt='$t("wallet.depositButton.cancel")',
      :button-submit-txt='$t("wallet.depositButton.confirm")',
      @cancel='clear'
    )
      q-input(
        v-model='quantity',
        standout='bg-teal text-white',
        :placeholder='$t("wallet.depositButton.amountPlaceholder")',
        type='number',
        :min='0',
        :rules='[(val) => val > 0 || $t("wallet.depositButton.amountPositiveError")]'
      )
        template(#append)
          span.text-overline {{ currency }}

  BaseDialog(
    v-else,
    v-model='showDialog',
    :title='$t("wallet.depositButton.paymentDialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    p {{ $t('wallet.depositButton.paymentInstructions', { amount: paymentOrder?.payment_details?.amount_without_fee, feePercent: paymentOrder?.payment_details?.fact_fee_percent, totalAmount: paymentOrder?.payment_details?.amount_plus_fee }) }}

    //- Предупреждение о счёте плательщика — для перевода по реквизитам; оплату картой в форме ЮKassa оно не касается.
    p(v-if='paymentOrder?.provider !== "yookassa"')
      span.text-bold {{ $t('wallet.depositButton.warningTitle') }}
      span.q-ml-xs {{ $t('wallet.depositButton.warningText') }}

    p(v-if='waitingConfirmation') {{ $t('wallet.depositButton.waitingConfirmation') }}
    PayWithProvider.q-mb-md(
      v-else,
      :payment-order='paymentOrder',
      @payment-fail='(message) => paymentFail(message)',
      @payment-success='onProviderSuccess'
    )
</template>

<script setup lang="ts">import { t } from 'src/shared/i18n';

interface Props {
  micro?: boolean;
  /**
   * Сумма, которую нужно внести: подставляется в поле при открытии окна.
   * С ней кнопка ведёт своё окно сама и не открывает окна других кнопок
   * пополнения на странице.
   */
  amount?: number | null;
  /** Подпись кнопки вместо значка — когда кнопка стоит внутри чужой формы. */
  label?: string;
  /** Кнопка с подписью — главное действие чужого окна: залита и обычного размера. */
  primary?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  micro: false,
  amount: null,
  label: '',
  primary: false,
});
const emit = defineEmits<{ deposited: [] }>();
import { ref, computed } from 'vue';
import { Form } from 'src/shared/ui/Form';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { useWalletStore } from 'src/entities/Wallet';
import type { ILoadUserWallet } from 'src/entities/Wallet/model';
import { PayWithProvider } from 'src/shared/ui/PayWithProvider';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { env } from 'src/shared/config';
import { useCreateDepositPayment } from 'src/features/Wallet/CreateDepositPayment';
import { useDepositDialog } from '../../model/useDepositDialog';
import { api as paymentApi } from 'src/entities/Payment/api';
import { useLiveReload } from 'src/shared/lib/realtime';
import { Zeus } from '@coopenomics/sdk';

const { info } = useSystemStore();

const walletStore = useWalletStore();
const { loadUserWallet } = walletStore;
const { createDeposit } = useCreateDepositPayment();

const session = useSessionStore();
const quantity = ref();
// Общее состояние открывает окно из любого места кошелька; кнопка с заданной суммой ведёт своё окно сама.
const showDialog = props.amount ? ref(false) : useDepositDialog().showDialog;

const openDialog = (): void => {
  if (props.amount) quantity.value = Math.ceil(Number(props.amount) * 100) / 100;
  showDialog.value = true;
};
const isSubmitting = ref(false);
const paymentOrder = ref();
// Форма провайдера сообщила об оплате, а кооператив ещё не зачислил взнос.
const waitingConfirmation = ref(false);

const isActive = computed(
  () => session.userAccount?.status === 'active',
);

const canContribute = computed(
  () => isActive.value && walletStore.isWalletAgreementSigned,
);

const clear = (): void => {
  showDialog.value = false;
  isSubmitting.value = false;
  paymentOrder.value = null;
  waitingConfirmation.value = false;
  // Сумму вводит пайщик: поле пустое, подсказка «Введите сумму».
  quantity.value = undefined;
};

const handlerSubmit = async (): Promise<void> => {
  isSubmitting.value = true;
  try {
    paymentOrder.value = await createDeposit({
      username: session.username,
      quantity: parseFloat(quantity.value),
      symbol: env.CURRENCY as string,
    });
    isSubmitting.value = false;
  } catch (e: any) {
    console.log('e.message', e.message);
    isSubmitting.value = false;
    FailAlert(e);
  }
};

const currency = computed(() => env.CURRENCY);

const paymentFail = (message?: string): void => {
  clear();
  FailAlert(message || t('wallet.depositButton.acceptError'));
};

const SUCCEEDED = [Zeus.PaymentStatus.PAID, Zeus.PaymentStatus.COMPLETED];
const DECLINED = [Zeus.PaymentStatus.FAILED, Zeus.PaymentStatus.CANCELLED, Zeus.PaymentStatus.EXPIRED];

/**
 * Исход платежа — по статусу у кооператива, а не по форме провайдера: форма
 * ЮKassa показывает «Успешно» с рекламой и сообщает исход только после этого
 * экрана, а взнос может быть и отклонён (поступило меньше заявленного).
 * Окно закрывается по сигналу ленты о платеже, форма убирается вместе с ним.
 */
const checkPaymentStatus = async (): Promise<void> => {
  const order = paymentOrder.value;
  if (!order?.hash) return;
  const result = await paymentApi.loadPayments(
    { hash: order.hash, username: session.username },
    { page: 1, limit: 1, sortOrder: 'DESC' },
  );
  const payment = result.items[0];
  if (!payment || paymentOrder.value?.hash !== order.hash) return;
  if (SUCCEEDED.includes(payment.status)) paymentSuccess();
  else if (DECLINED.includes(payment.status)) paymentFail(payment.message || undefined);
};

useLiveReload([{ code: 'core', table: 'payments' }], checkPaymentStatus);

const onProviderSuccess = (): void => {
  waitingConfirmation.value = true;
  void checkPaymentStatus();
};

const paymentSuccess = (): void => {
  loadUserWallet({
    coopname: info.coopname,
    username: session.username as string,
  } as ILoadUserWallet);
  clear();
  SuccessAlert(t('wallet.depositButton.acceptSuccess'));
  emit('deposited');
};
</script>
<style scoped></style>
