<template lang="pug">
//- Подписки кооператива у провайдера одним реестром и журнал списаний под ним:
//- хостинг, документооборот и приложения из каталога — строками одной таблицы.
div.row.q-pa-md
  div.col-md-12.col-xs-12
    ConnectionSectionGate
      .conn-subs
        SubscriptionsCard
        PaymentsHistory(
          v-if="coopname"
          :coopname="coopname"
          :title="$t('connectionDashboard.dashboard.paymentsTitle')"
          :subtitle="$t('connectionDashboard.dashboard.paymentsSubtitle')"
          :limit="20"
        )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SubscriptionsCard } from 'src/widgets/ConnectionDashboard'
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { useSystemStore } from 'src/entities/System/model'
import ConnectionSectionGate from './ConnectionSectionGate.vue'

const { info } = useSystemStore()
const coopname = computed(() => info.coopname || '')
</script>

<style scoped>
.conn-subs {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
