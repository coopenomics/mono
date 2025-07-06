<template lang="pug">
.payment-card__container
  q-card.payment-card(flat)
    q-card-section.payment-card__header-section(
      :class='{ "cursor-pointer": $q.screen.lt.md }',
      @click='$q.screen.lt.md ? $emit("toggle-expand") : undefined'
    )
      .payment-header
        .payment-icon
          q-icon(
            :name='getDirectionIcon(payment.direction)',
            size='24px',
            :color='getDirectionColor(payment.direction)'
          )
        .payment-title
          .title {{ payment.type_label }}
          .subtitle {{ getShortNameFromCertificate(payment.username_certificate) || payment.username }}
      .payment-amount
        .amount {{ payment.quantity }} {{ payment.symbol }}
        .status
          q-badge(:color='getStatusColor(payment.status)') {{ payment.status_label }}

    q-slide-transition
      div(v-show='expanded')
        q-separator

        // Блок с действиями в самом верху разворота
        q-card-section.actions-section(
          v-if='!hideActions && hasAvailableActions'
        )
          .row.justify-center
            SetOrderPaidStatusButton(
              v-if='payment.id && ["PENDING", "FAILED", "EXPIRED"].includes(payment.status)',
              :id='payment.id'
            )

        q-card-section
          PaymentDetails(:payment='payment')

  // Только кнопка разворота снаружи
  .expand-button-external
    q-btn(
      flat,
      dense,
      size='sm',
      :icon='expanded ? "expand_less" : "expand_more"',
      @click.stop='$emit("toggle-expand")',
      color='primary',
      round
    )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { SetOrderPaidStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderPaidStatusButton';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import 'src/shared/ui/CardStyles/index.scss';
import { PaymentDetails } from 'src/shared/ui';
import type { IPayment } from 'src/entities/Payment';
import { Zeus } from '@coopenomics/sdk';

const $q = useQuasar();

const props = defineProps<{
  payment: IPayment;
  expanded?: boolean;
  hideActions?: boolean;
}>();

defineEmits(['toggle-expand', 'close-dropdown']);

// Проверяем наличие доступных действий (аналогично логике в таблице)
const hasAvailableActions = computed(() => {
  return ['EXPIRED', 'PENDING', 'FAILED'].includes(props.payment.status || '');
});

const getDirectionIcon = (direction?: string | null) => {
  return direction === Zeus.PaymentDirection.INCOMING
    ? 'fa-solid fa-arrow-down'
    : 'fa-solid fa-arrow-up';
};

const getDirectionColor = (direction?: string | null) => {
  return direction === Zeus.PaymentDirection.INCOMING ? 'positive' : 'negative';
};

const statusColors: Record<string, string> = {
  [Zeus.PaymentStatus.COMPLETED]: 'teal',
  [Zeus.PaymentStatus.PENDING]: 'orange',
  [Zeus.PaymentStatus.FAILED]: 'red',
  [Zeus.PaymentStatus.PAID]: 'blue',
  [Zeus.PaymentStatus.REFUNDED]: 'grey',
  [Zeus.PaymentStatus.EXPIRED]: 'grey',
};

const getStatusColor = (status?: string | null) => {
  if (!status) {
    return 'grey';
  }
  return statusColors[status] || 'grey';
};
</script>

<style lang="scss" scoped>
.payment-card__container {
  padding: 8px;
  width: 100%;
}

.payment-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease-in-out;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
}

.payment-card__header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.payment-title .title {
  font-size: 16px;
  font-weight: 500;
}

.payment-title .subtitle {
  font-size: 12px;
  color: #757575;
}

.payment-amount {
  text-align: right;
}

.payment-amount .amount {
  font-size: 18px;
  font-weight: 600;
}

.payment-amount .status {
  margin-top: 4px;
}

.expand-button-external {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px;
}

.actions-section {
  padding: 12px 16px !important;
  background-color: rgba(0, 0, 0, 0.02);
}
</style>
