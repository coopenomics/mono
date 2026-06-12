<template lang="pug">
.payment-details
  .payment-details-content
  // Показываем причину ошибки для неуспешных платежей
  div(v-if='payment.status === "FAILED"')
    .payment-error.text-red-6.q-mb-sm
      q-icon.q-mr-xs(name='error', size='sm')
      span {{ payment.message || 'нет дополнительной информации' }}

  // Показываем реквизиты для исходящих платежей
  div(v-else-if='payment.direction === "OUTGOING" && payment.payment_details')
    q-card.q-pa-md(flat)
      .row.q-gutter-md
        .col-12.col-md-6(v-if='bankData?.bank_name')
          CopyableInput.full-width(
            :label='"Банк получателя"',
            :model-value='bankData.bank_name',
            dense
          )

        .col-12.col-md-6(v-if='bankData?.details?.bik')
          CopyableInput.full-width(
            :label='"БИК"',
            :model-value='bankData.details.bik',
            dense,
            input-class='font-mono'
          )

        .col-12.col-md-6(v-if='bankData?.account_number')
          CopyableInput.full-width(
            :label='"Номер счета"',
            :model-value='bankData.account_number',
            dense,
            input-class='font-mono'
          )

        .col-12.col-md-6(v-if='bankData?.details?.corr')
          CopyableInput.full-width(
            :label='"Корреспондентский счет"',
            :model-value='bankData.details.corr',
            dense,
            input-class='font-mono'
          )

        .col-12.col-md-6(v-if='bankData?.details?.kpp')
          CopyableInput.full-width(
            :label='"КПП"',
            :model-value='bankData.details.kpp',
            dense,
            input-class='font-mono'
          )

        .col-12.col-md-6(v-if='bankData?.card_number')
          CopyableInput.full-width(
            :label='"Номер карты"',
            :model-value='bankData.card_number',
            dense,
            input-class='font-mono'
          )

        .col-12.col-md-6(v-if='bankData?.currency')
          CopyableInput.full-width(
            :label='"Валюта"',
            :model-value='bankData.currency',
            dense
          )

        .col-12.col-md-6(v-if='sbpData?.phone')
          CopyableInput.full-width(
            :label='"Телефон (СБП)"',
            :model-value='sbpData.phone',
            dense
          )

        .col-12.col-md-6(v-if='payment.memo')
          CopyableInput.full-width(
            :label='"Назначение платежа"',
            :model-value='payment.memo',
            dense
          )

        // Показываем информацию о сумме и комиссии
        .col-12.col-md-6(v-if='payment.payment_details.amount_without_fee')
          CopyableInput.full-width(
            :label='"Сумма к переводу"',
            :model-value='formattedTransferAmount',
            dense,
            input-class='text-weight-medium'
          )

        .col-12.col-md-6(
          v-if='payment.payment_details.fee_amount && payment.payment_details.fee_amount !== "0"'
        )
          CopyableInput.full-width(
            :label='"Комиссия"',
            :model-value='payment.payment_details.fee_amount',
            dense
          )

  // Показываем blockchain данные если есть
  div(v-else-if='payment.blockchain_data')
    .text-weight-medium.q-mb-sm Дополнительная информация:
    q-card.q-pa-md.bg-grey-1(flat)
      .text-caption.text-grey-7.q-mb-xs Данные блокчейна
      pre.text-body2.q-mb-none.font-mono {{ formatBlockchainData(payment.blockchain_data) }}

  // Показываем сообщение по умолчанию
  div(v-else)
    .text-grey-6.text-center.q-py-md
      q-icon.q-mr-xs(name='info_outline', size='sm')
      span нет дополнительной информации
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CopyableInput } from 'src/shared/ui';
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

// Сумма к переводу — канонический формат «1 000,00 RUB», не сырой
// on-chain precision=4.
const formattedTransferAmount = computed(() => {
  const raw = payment.payment_details?.amount_without_fee ?? '';
  const currency = bankData.value?.currency ?? '';
  return formatAsset2Digits(currency ? `${raw} ${currency}` : String(raw));
});

/**
 * Форматирует данные блокчейна для отображения
 */
const formatBlockchainData = (data: any): string => {
  if (!data) return '';

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};
</script>

<style lang="scss" scoped>
.payment-details {
  // Размер НЕ уменьшаем (был 0.9em): mono-поля выглядели мельче соседних,
  // реквизиты в одном развороте обязаны быть одного размера.
  .font-mono {
    font-family: var(--p-mono, 'JetBrains Mono', 'Monaco', 'Consolas', monospace);
  }

  pre {
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  }

  // Ограничиваем ширину всего контента для лучшей читаемости
  .payment-error {
    text-wrap: auto;
  }
}
</style>
