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
        q-card-section
          PaymentDetails(:payment='payment')

  .card-actions-external
    q-btn-dropdown(
      v-if='!hideActions && payment.can_change_status',
      dense,
      size='sm',
      label='Действия',
      color='primary',
      flat,
      @click.stop
    )
      q-list(dense)
        SetOrderPaidStatusButton(
          v-if='payment.id && [Zeus.PaymentStatus.PENDING, Zeus.PaymentStatus.FAILED].includes(payment.status)',
          :id='payment.id',
          @close='$emit("close-dropdown")'
        )
        SetOrderRefundedStatusButton(
          v-if='payment.id && [Zeus.PaymentStatus.PAID, Zeus.PaymentStatus.COMPLETED].includes(payment.status)',
          :id='payment.id',
          @close='$emit("close-dropdown")'
        )
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
import { useQuasar } from 'quasar';
import { SetOrderPaidStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderPaidStatusButton';
import { SetOrderRefundedStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderRefundedStatusButton';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import 'src/shared/ui/CardStyles/index.scss';
import { PaymentDetails } from 'src/shared/ui';
import type { IPayment } from 'src/entities/Payment';
import { Zeus } from '@coopenomics/sdk';

const $q = useQuasar();

defineProps<{
  payment: IPayment;
  expanded?: boolean;
  hideActions?: boolean;
}>();

defineEmits(['toggle-expand', 'close-dropdown']);

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

.card-actions-external {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px;
  gap: 8px;
}
</style>
