<template lang="pug">
q-btn(
  v-if='isActive',
  @click='showDialog = true',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :dense='micro',
  :size='micro ? "sm" : undefined'
)
  q-icon(:name='micro ? "fa-solid fa-arrow-up" : "fa-solid fa-chevron-up"')
  span(v-if='!micro').q-ml-sm Совершить взнос
  q-tooltip(v-if='micro') Внести
  q-dialog(v-model='showDialog', @hide='clear')
    ModalBase(v-if='!paymentOrder', :title='"Паевой взнос"')
      Form.q-pa-sm(
        :handler-submit='handlerSubmit',
        :is-submitting='isSubmitting',
        :button-cancel-txt='"Отменить"',
        :button-submit-txt='"Продолжить"',
        @cancel='clear'
      )
        q-input(
          v-model='quantity',
          standout='bg-teal text-white',
          placeholder='Введите сумму',
          type='number',
          :min='0',
          :rules='[(val) => val > 0 || "Сумма взноса должна быть положительной"]'
        )
          template(#append)
            span.text-overline {{ currency }}

    ModalBase(
      v-else,
      :title='"Совершите взнос"',
      style='min-height: 200px !important'
    )
      .q-pa-md(style='max-width: 400px')
        p Пожалуйста, совершите оплату паевого взноса {{ paymentOrder?.payment_details?.amount_without_fee }}. Комиссия провайдера {{ paymentOrder?.payment_details?.fact_fee_percent }}%, всего к оплате: {{ paymentOrder?.payment_details?.amount_plus_fee }}.

        span.text-bold Внимание!
        span.q-ml-xs Оплату необходимо произвести с банковского счета, который принадлежит именно Вам. При поступлении средств с другого счета, оплата будет аннулирована.

      PayWithProvider.q-mb-md.q-pa-md(
        :payment-order='paymentOrder',
        @payment-fail='paymentFail',
        @payment-success='paymentSuccess'
      )
</template>

<script setup lang="ts">
interface Props {
  micro?: boolean;
}

withDefaults(defineProps<Props>(), {
  micro: false,
});
import { ref, computed } from 'vue';
import { Form } from 'src/shared/ui/Form';
import { ModalBase } from 'src/shared/ui/ModalBase';
import { useWalletStore } from 'src/entities/Wallet';
import type { ILoadUserWallet } from 'src/entities/Wallet/model';
import { PayWithProvider } from 'src/shared/ui/PayWithProvider';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { env } from 'src/shared/config';
import { useCreateDepositPayment } from 'src/features/Wallet/CreateDepositPayment';
import { useDepositDialog } from '../../model/useDepositDialog';

const { info } = useSystemStore();

const { loadUserWallet } = useWalletStore();
const { createDeposit } = useCreateDepositPayment();

//TODO move username to Session entity
const session = useSessionStore();
const quantity = ref();
const { showDialog } = useDepositDialog();
const isSubmitting = ref(false);
const paymentOrder = ref();

// Кнопка доступна только принятым пайщикам (user_account.status === 'active').
// До приёма советом мутация createDepositPayment всё равно отвергается на бэке
// гвардом ActiveUserStatusGuard — здесь прячем сам контрол, чтобы не водить
// пользователя по тупиковому пути.
const isActive = computed(
  () => session.userAccount?.status === 'active',
);

const clear = (): void => {
  showDialog.value = false;
  isSubmitting.value = false;
  paymentOrder.value = null;
  quantity.value = 1000;
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

const paymentFail = (): void => {
  clear();
  FailAlert('Произошла ошибка при приёме платежа');
};

const paymentSuccess = (): void => {
  loadUserWallet({
    coopname: info.coopname,
    username: session.username as string,
  } as ILoadUserWallet);
  clear();
  SuccessAlert('Платеж успешно принят');
};
</script>
<style scoped></style>
