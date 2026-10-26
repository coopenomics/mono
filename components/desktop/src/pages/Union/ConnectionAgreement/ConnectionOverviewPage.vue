<template lang="pug">
//- Счёт кооператива у оператора: долг первым экраном, затем кошельки.
.conn-overview
  //- Одна подсказка на раздел (канон): вся денежная механика подключения.
  PageHint(storage-key="connection:dashboard:banner-dismissed")
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine1') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine2') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine3') }}
    | {{ $t('connectionDashboard.dashboard.paymentNoteLine4') }}

  //- Просрочка и приостановка — первым экраном: пока долг не закрыт, всё
  //- остальное вторично.
  BillingDueCard

  .conn-overview__wallets.row.q-col-gutter-md
    .col-12.col-md-6
      MembershipWallet
    .col-12.col-md-6
      AxonWallet
</template>

<script setup lang="ts">
import { PageHint } from 'src/shared/ui/domain'
import { AxonWallet, MembershipWallet, BillingDueCard } from 'src/widgets/ConnectionDashboard'
</script>

<style scoped>
.conn-overview {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
/* Кошельки — одной высоты: у членских есть строка действия, у AXON её нет,
   и без растяжения плитки стояли бы ступенькой. */
.conn-overview__wallets > [class^='col'] {
  display: flex;
}
.conn-overview__wallets :deep(.wallet) {
  flex: 1;
}
</style>
