<template lang="pug">
//- Вкладка «Кошельки» подключённого кооператива: членские взносы (ими платятся
//- подписки) и AXON (ресурс документооборота). Подписки, списания и настройки
//- подключения — соседними вкладками.
.conn-wallets.row.q-col-gutter-md
  .col-12.col-md-6
    MembershipCard
  .col-12.col-md-6
    AxonWallet
</template>

<script setup lang="ts">
import { AxonWallet, MembershipCard } from 'src/widgets/ConnectionDashboard'
</script>

<style scoped>
/* Кошельки — одной высоты: подвалы у них разные, без растяжения плитки
   стояли бы ступенькой. */
.conn-wallets > [class^='col'] {
  display: flex;
}
.conn-wallets :deep(.wallet) {
  flex: 1;
}
</style>
