<template lang="pug">
//- Вкладка «Подключение» подключённого кооператива: адрес кооператива
//- первым, затем долг и кошельки.
.conn-overview
  DomainCard

  //- Просрочка и приостановка — до кошельков: пока долг не закрыт, всё
  //- остальное вторично.
  BillingDueCard

  .conn-overview__wallets.row.q-col-gutter-md
    .col-12.col-md-6
      MembershipWallet
    .col-12.col-md-6
      AxonWallet
</template>

<script setup lang="ts">
import { AxonWallet, MembershipWallet, BillingDueCard, DomainCard } from 'src/widgets/ConnectionDashboard'
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
