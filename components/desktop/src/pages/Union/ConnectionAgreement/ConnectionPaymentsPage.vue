<template lang="pug">
//- Вкладка «История списаний»: оплаты подписок членскими взносами кооператива.
//- Заголовок страницы — в шапке, поэтому таблица лежит на странице без
//- карточки-дубля.
.conn-payments
  PageHint(storage-key="connection:payments:hint") {{ $t('connectionDashboard.dashboard.paymentsSubtitle') }}
  PaymentsHistory(v-if="coopname" :coopname="coopname" :limit="50")
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PageHint } from 'src/shared/ui/domain'
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { useSystemStore } from 'src/entities/System/model'

const { info } = useSystemStore()
const coopname = computed(() => info.coopname || '')
</script>

<style scoped>
.conn-payments {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
</style>
