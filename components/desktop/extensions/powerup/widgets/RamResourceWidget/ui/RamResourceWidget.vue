<template lang="pug">
.resource-card
  .resource-card__head
    .resource-card__icon
      i.fas.fa-memory
    .resource-card__title Оперативная память (RAM)

  .resource-card__gauge
    q-circular-progress(
      :value="usagePercent"
      size="148px"
      :thickness="0.14"
      :color="gaugeColor"
      track-color="grey-3"
      rounded
      show-value
    )
      .gauge-inner
        .gauge-value {{ usagePercent.toFixed(2) }}%
        .gauge-label Использовано

  .resource-card__note RAM используется для временного хранения данных пайщиков при исполнении смарт-контрактов.

  button.resource-card__toggle(type="button", @click="showDetails = !showDetails")
    span {{ showDetails ? 'Скрыть детали' : 'Подробнее' }}
    q-icon(:name="showDetails ? 'expand_less' : 'expand_more'", size="18px")

  q-slide-transition
    .resource-card__details(v-show="showDetails")
      .detail-row
        span.detail-label Используется
        span.detail-value {{ formatBytes(ramUsage) }}
      .detail-row
        span.detail-label Доступно
        span.detail-value {{ formatBytes(available) }} ({{ availablePercent.toFixed(1) }}%)
      .detail-row
        span.detail-label Квота
        span.detail-value {{ formatBytes(ramQuota) }}
      .detail-row
        span.detail-label Стоимость
        span.detail-value {{ formatCost(estimatedCost) }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useSystemStore } from 'src/entities/System/model'

const showDetails = ref(false)

const systemStore = useSystemStore()

const ramQuota = computed(() => {
  return systemStore.info.blockchain_account?.ram_quota || 0
})

const ramUsage = computed(() => {
  return systemStore.info.blockchain_account?.ram_usage || 0
})

const available = computed(() => {
  return ramQuota.value - ramUsage.value
})

const usagePercent = computed(() => {
  if (!ramQuota.value) return 0
  return (ramUsage.value / ramQuota.value) * 100
})

const availablePercent = computed(() => {
  if (!ramQuota.value) return 0
  return (available.value / ramQuota.value) * 100
})

// Цвет кольца: канон-статусы. Базовый — positive; при перегрузке квоты
// переключаемся на предупреждающий и негативный.
const gaugeColor = computed(() => {
  const percent = usagePercent.value
  if (percent >= 95) return 'negative'
  if (percent >= 80) return 'warning'
  return 'positive'
})

// Примерная оценка стоимости дополнительного RAM (упрощенная логика)
const estimatedCost = computed(() => {
  // В EOSIO RAM стоит примерно 0.01 AXON за KB (упрощенная оценка)
  const additionalKb = Math.max(0, (ramQuota.value - ramUsage.value) / 1024)
  return additionalKb * 0.01
})

const formatBytes = (bytes: number): string => {
  if (bytes >= 1073741824) {
    return (bytes / 1073741824).toFixed(1) + 'GB'
  } else if (bytes >= 1048576) {
    return (bytes / 1048576).toFixed(1) + 'MB'
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(1) + 'KB'
  }
  return bytes + 'B'
}

const formatCost = (cost: number): string => {
  if (cost >= 1) {
    return cost.toFixed(2) + ' AXON'
  } else if (cost >= 0.01) {
    return cost.toFixed(4) + ' AXON'
  } else {
    return '< 0.01 AXON'
  }
}
</script>

<style lang="scss" scoped>
@use './../../../shared/resource-card.scss';

.resource-card__icon {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
</style>
