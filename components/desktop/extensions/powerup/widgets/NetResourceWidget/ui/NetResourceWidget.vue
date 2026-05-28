<template lang="pug">
.resource-card
  .resource-card__head
    .resource-card__icon
      i.fas.fa-network-wired
    .resource-card__title Сетевой трафик (NET)

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

  .resource-card__note NET используется для передачи данных документов между узлами блокчейна.

  button.resource-card__toggle(type="button", @click="showDetails = !showDetails")
    span {{ showDetails ? 'Скрыть детали' : 'Подробнее' }}
    q-icon(:name="showDetails ? 'expand_less' : 'expand_more'", size="18px")

  q-slide-transition
    .resource-card__details(v-show="showDetails")
      .detail-row
        span.detail-label Используется
        span.detail-value {{ formatBytes(currentUsed) }}
      .detail-row
        span.detail-label Доступно
        span.detail-value {{ formatBytes(available) }} ({{ availablePercent.toFixed(1) }}%)
      .detail-row
        span.detail-label Максимум
        span.detail-value {{ formatBytes(max) }}
      .detail-row
        span.detail-label Восстановление
        span.detail-value ~{{ formatTime(estimatedRecovery) }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useSystemStore } from 'src/entities/System/model'

const showDetails = ref(false)

interface NetLimit {
  available: string
  current_used?: string | null
  max: string
  used: string
  last_usage_update_time?: string | null
}

const systemStore = useSystemStore()

const netLimit = computed<NetLimit | null>(() => {
  return systemStore.info.blockchain_account?.net_limit || null
})

const currentUsed = computed(() => {
  return netLimit.value?.current_used ? parseInt(netLimit.value.current_used) : 0
})

const available = computed(() => {
  return netLimit.value ? parseInt(netLimit.value.available) : 0
})

const max = computed(() => {
  return netLimit.value ? parseInt(netLimit.value.max) : 0
})

const usagePercent = computed(() => {
  if (!max.value) return 0
  return (currentUsed.value / max.value) * 100
})

const availablePercent = computed(() => {
  if (!max.value) return 0
  return (available.value / max.value) * 100
})

// Цвет кольца: канон-статусы. Базовый — info; при перегрузке квоты
// переключаемся на предупреждающий и негативный.
const gaugeColor = computed(() => {
  const percent = usagePercent.value
  if (percent >= 90) return 'negative'
  if (percent >= 70) return 'warning'
  return 'info'
})

// Примерная оценка времени восстановления (упрощенная логика)
const estimatedRecovery = computed(() => {
  if (!netLimit.value) return 0
  // В EOSIO NET восстанавливается примерно 1/3 от максимума каждые 24 часа
  const recoveryRate = max.value / 3 / 86400 // байт в секунду
  const neededRecovery = max.value - available.value
  return neededRecovery / recoveryRate
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

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}д ${hours % 24}ч`
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`
  } else {
    return `${minutes}м`
  }
}
</script>

<style lang="scss" scoped>
@use './../../../shared/resource-card.scss';

.resource-card__icon {
  background: var(--p-info-soft);
  color: var(--p-info);
}
</style>
