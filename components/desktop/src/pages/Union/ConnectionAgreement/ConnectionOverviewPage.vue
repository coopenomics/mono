<template lang="pug">
//- Вкладка «Подключение»: три блока сверху вниз — членские взносы с остатком,
//- состоянием оплаты и «Пополнить»; документооборот словами; адрес кооператива.
.conn-overview
  MembershipCard
  DocflowCard
  DomainCard
</template>

<script setup lang="ts">
import { DocflowCard, DomainCard, MembershipCard } from 'src/widgets/ConnectionDashboard'
</script>

<style scoped>
.conn-overview {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
