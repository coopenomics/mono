<template lang="pug">
.payment-details
  //- Причина отклонения платежа кассиром (CANCELLED). Кассир пишет её в диалоге
  //- «Отклонить»; показываем заметным баннером сразу при раскрытии — общий
  //- компонент рендерится и на столе совета, и на столе пайщика.
  .banner.banner--neg.q-mb-sm(v-if='payment.status === "CANCELLED"')
    .banner__icon
      q-icon(name='block', size='sm')
    .banner__body
      .t-sm.t-muted Платёж отклонён. Причина:
      div {{ payment.message || 'причина не указана' }}

  //- Причина ошибки для неуспешных платежей
  .payment-error.text-red-6.q-mb-sm(v-if='payment.status === "FAILED"')
    q-icon.q-mr-xs(name='error', size='sm')
    span {{ payment.message || 'нет дополнительной информации' }}

  //- Реквизиты платежа — компактные строки с копированием (DataRow). Для любого
  //- направления: исходящий = реквизиты получателя (кому платит кооператив),
  //- входящий возврат = реквизиты кооператива (куда платит пайщик).
  template(v-else-if='payment.payment_details')
    DataRow(v-if='bankData?.bank_name', label='Банк получателя', :value='bankData.bank_name', copyable)
    DataRow(v-if='bankData?.details?.bik', label='БИК', :value='bankData.details.bik', copyable, mono)
    DataRow(v-if='bankData?.account_number', label='Номер счета', :value='bankData.account_number', copyable, mono)
    DataRow(v-if='bankData?.details?.corr', label='Корреспондентский счет', :value='bankData.details.corr', copyable, mono)
    DataRow(v-if='bankData?.card_number', label='Номер карты', :value='bankData.card_number', copyable, mono)
    DataRow(v-if='bankData?.currency', label='Валюта', :value='bankData.currency')
    DataRow(v-if='sbpData?.phone', label='Телефон (СБП)', :value='sbpData.phone', copyable, mono)
    //- Оплата расхода: получатель-организация и её реквизиты приходят
    //- свободной строкой из снимка СЗ (не платёжным методом пайщика).
    DataRow(v-if='freeData?.recipient_name', label='Получатель', :value='freeData.recipient_name', copyable)
    DataRow(v-if='freeData?.requisites', label='Реквизиты', :value='freeData.requisites', copyable, mono)
    DataRow(v-if='expenseDescription', label='Что оплачиваем', :value='expenseDescription')
    DataRow(v-if='payment.memo', label='Назначение платежа', :value='payment.memo', copyable)
    DataRow(
      v-if='amountToPayLabel',
      label='Сумма к переводу',
      :value='amountToPayLabel',
      copyable,
      mono
    )
    DataRow(
      v-if='payment.payment_details.fee_amount && payment.payment_details.fee_amount !== "0"',
      label='Комиссия',
      :value='payment.payment_details.fee_amount',
      mono
    )

  //- Назначение платежа без банковских реквизитов: даём скопировать готовый текст.
  template(v-else-if='payment.memo || expenseDescription')
    DataRow(v-if='expenseDescription', label='Что оплачиваем', :value='expenseDescription')
    DataRow(v-if='payment.memo', label='Назначение платежа', :value='payment.memo', copyable)

  //- Сообщение по умолчанию
  div(v-else)
    .text-grey-6.text-center.q-py-md
      q-icon.q-mr-xs(name='info_outline', size='sm')
      span нет дополнительной информации
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import type { IPayment, IBankAccount, ISbpAccount } from 'src/entities/Payment';

interface Props {
  payment: IPayment;
}

const props = defineProps<Props>();
const payment = props.payment;

// Типизированные computed для различных типов данных платежных методов
const bankData = computed(() => {
  const data = payment.payment_details?.data;
  // Проверяем, является ли это банковским аккаунтом (есть поле bank_name)
  if (data && typeof data === 'object' && 'bank_name' in data) {
    return data as IBankAccount;
  }
  return null;
});

const sbpData = computed(() => {
  const data = payment.payment_details?.data;
  // Проверяем, является ли это СБП аккаунтом (есть поле phone)
  if (data && typeof data === 'object' && 'phone' in data) {
    return data as ISbpAccount;
  }
  return null;
});

// Свободные реквизиты (оплата расхода организации/ИП по снимку СЗ)
const freeData = computed(() => {
  const data = payment.payment_details?.data;
  if (data && typeof data === 'object' && ('requisites' in data || 'recipient_name' in data)) {
    return data as { recipient_name?: string; requisites?: string };
  }
  return null;
});

// Описание позиции расхода — кассиру важно видеть, что именно оплачивается
const expenseDescription = computed(() => {
  const data = payment.blockchain_data;
  if (data && typeof data === 'object' && 'description' in data) {
    return (data as { description?: string }).description || null;
  }
  return null;
});

// Сумма к переводу — 2 знака после запятой (как везде в UI), с валютой.
const amountToPayLabel = computed(() => {
  const raw = payment.payment_details?.amount_without_fee;
  if (!raw) return '';
  const currency = bankData.value?.currency || payment.symbol || '';
  return formatAsset2Digits(`${raw} ${currency}`.trim());
});
</script>

<style lang="scss" scoped>
.payment-details {
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    font-family: var(--p-mono);
  }

  .payment-error {
    text-wrap: auto;
  }
}
</style>
