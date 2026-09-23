<template lang="pug">
div.q-pa-xs.col-xs-12.col-sm-12.col-md-12.q-mt-md
  q-card(bordered flat)
    q-card-section.q-py-xs
      div.text-subtitle2 № {{ order.order_num }}
      div.text-caption {{ $t('cooperative.orderCard.amountLabel', { quantity: order.quantity }) }}

    q-separator

    q-card-section.q-py-xs
      div.row.items-center
        div.col-6 {{ $t('cooperative.orderCard.typeLabel') }}
        div.col-6.text-right
          q-badge(v-if="order.type ==='registration'") {{ $t('cooperative.orderCard.typeRegistration') }}
          q-badge(v-if="order.type ==='deposit'") {{ $t('cooperative.orderCard.typeDeposit') }}

      div.row.items-center.q-mt-sm
        div.col-6 {{ $t('cooperative.orderCard.fromLabel') }}
        div.col-6.text-right {{ getNameFromUserData(order.user?.private_data) }}

      div.row.items-center.q-mt-sm
        div.col-6 {{ $t('cooperative.orderCard.statusLabel') }}
        div.col-6.text-right
          q-badge(v-if="order.status ==='completed'" color="teal") {{ $t('cooperative.orderCard.statusCompleted') }}
          q-badge(v-if="order.status ==='pending'" color="orange") {{ $t('cooperative.orderCard.statusPending') }}
          q-badge(v-if="order.status ==='failed'" color="red") {{ $t('cooperative.orderCard.statusFailed') }}
          q-badge(v-if="order.status ==='paid'" color="orange") {{ $t('cooperative.orderCard.statusPaid') }}
          q-badge(v-if="order.status ==='refunded'" color="grey") {{ $t('cooperative.orderCard.statusRefunded') }}
          q-badge(v-if="order.status ==='expired'" color="grey") {{ $t('cooperative.orderCard.statusExpired') }}

    q-card-actions(align="right")
      ExpandToggleButton(
        v-if="order.message"
        :expanded="expanded"
        variant="card"
        @click="$emit('toggle-expand')"
      )
        | {{ expanded ? $t('cooperative.orderCard.collapseLabel') : $t('cooperative.orderCard.expandLabel') }}

      q-btn-dropdown(v-if="!hideActions" size="sm" :label="$t('cooperative.orderCard.actionsLabel')" color="primary")
        q-list(dense)
          SetOrderPaidStatusButton(:id="order.id" @close="$emit('close-dropdown')")
          SetOrderRefundedStatusButton(:id="order.id" @close="$emit('close-dropdown')")

    q-slide-transition
      div(v-show="expanded && order.message")
        q-separator
        q-card-section
          p {{ $t('cooperative.orderCard.errorReasonLabel', { message: order.message }) }}
</template>

<script setup lang="ts">
import { getNameFromUserData } from 'src/shared/lib/utils/getNameFromUserData';
import { SetOrderPaidStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderPaidStatusButton';
import { SetOrderRefundedStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderRefundedStatusButton';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';

defineProps({
  order: {
    type: Object,
    required: true
  },
  expanded: {
    type: Boolean,
    default: false
  },
  hideActions: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-expand', 'close-dropdown'])
</script>
