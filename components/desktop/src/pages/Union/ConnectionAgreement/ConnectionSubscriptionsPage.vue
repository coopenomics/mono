<template lang="pug">
//- Вкладка «Подписки»: действующие подписки у провайдера одним реестром
//- (хостинг, документооборот, приложения из каталога) и журнал списаний под ним.
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
