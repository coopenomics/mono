<script setup lang="ts">
import type {
  IPaymentOrder,
  IInitialPaymentOrder,
} from 'src/shared/lib/types/payments';
import { BankProvider } from '../Providers/Bank';
import { Yookassa } from '../Providers/Yookassa';

defineProps<{
  paymentOrder: IPaymentOrder | IInitialPaymentOrder;
}>();

const emit = defineEmits(['paymentSuccess', 'paymentFail']);
</script>

<template lang="pug">
div(v-if='paymentOrder.payment_details?.data')
  BankProvider(
    v-if='paymentOrder.provider == "qrpay"',
    :payment-order='paymentOrder',
    @payment-fail='(message) => emit("paymentFail", message)',
    @payment-success='emit("paymentSuccess")'
  )
  Yookassa(
    v-if='paymentOrder.provider == "yookassa"',
    :payment-order='paymentOrder',
    @payment-fail='(message) => emit("paymentFail", message)',
    @payment-success='emit("paymentSuccess")'
  )
</template>
