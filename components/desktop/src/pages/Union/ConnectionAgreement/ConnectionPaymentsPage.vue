<template lang="pug">
//- Журнал списаний за подписки: тот же виджет, что видит совет в карточке
//- кооператива — здесь он отвечает на вопрос «за что и когда списали».
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
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { useSystemStore } from 'src/entities/System/model'

const { info } = useSystemStore()
const coopname = computed(() => info.coopname || '')
</script>
