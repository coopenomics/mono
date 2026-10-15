<template lang="pug">
.resource-card
  .resource-card__head
    .resource-card__icon
      i.fas.fa-microchip
    .resource-card__title {{ $t('powerup.cpuResourceWidget.title') }}

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
        .gauge-label {{ $t('powerup.cpuResourceWidget.usedLabel') }}

  .resource-card__note {{ $t('powerup.cpuResourceWidget.note') }}

  button.resource-card__toggle(type="button", @click="showDetails = !showDetails")
    span {{ showDetails ? $t('powerup.cpuResourceWidget.hideDetails') : $t('powerup.cpuResourceWidget.showDetails') }}
    q-icon(:name="showDetails ? 'expand_less' : 'expand_more'", size="18px")

  q-slide-transition
    .resource-card__details(v-show="showDetails")
      .detail-row
        span.detail-label {{ $t('powerup.cpuResourceWidget.usedDetailLabel') }}
        span.detail-value {{ formatValue(currentUsed) }} μs
      .detail-row
        span.detail-label {{ $t('powerup.cpuResourceWidget.availableLabel') }}
        span.detail-value {{ formatValue(available) }} μs ({{ availablePercent.toFixed(1) }}%)
      .detail-row
        span.detail-label {{ $t('powerup.cpuResourceWidget.maxLabel') }}
        span.detail-value {{ formatValue(max) }} μs
      .detail-row
        span.detail-label {{ $t('powerup.cpuResourceWidget.recoveryLabel') }}
        span.detail-value ~{{ formatTime(estimatedRecovery) }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { t } from '../../../i18n';

const showDetails = ref(false)

interface CpuLimit {
  available: string
  current_used?: string | null
  max: string
  used: string
  last_usage_update_time?: string | null
}

const systemStore = useSystemStore()

const cpuLimit = computed<CpuLimit | null>(() => {
  return systemStore.info.blockchain_account?.cpu_limit || null
})

const currentUsed = computed(() => {
  return cpuLimit.value?.current_used ? parseInt(cpuLimit.value.current_used) : 0
})

const available = computed(() => {
  return cpuLimit.value ? parseInt(cpuLimit.value.available) : 0
})

const max = computed(() => {
  return cpuLimit.value ? parseInt(cpuLimit.value.max) : 0
})

const usagePercent = computed(() => {
  if (!max.value) return 0
  return (currentUsed.value / max.value) * 100
})

const availablePercent = computed(() => {
  if (!max.value) return 0
  return (available.value / max.value) * 100
})

// Цвет кольца: канон-статусы. Базовый — primary; при перегрузке квоты
// переключаемся на предупреждающий и негативный.
const gaugeColor = computed(() => {
  const percent = usagePercent.value
  if (percent >= 90) return 'negative'
  if (percent >= 70) return 'warning'
  return 'primary'
})

// Примерная оценка времени восстановления (упрощенная логика)
const estimatedRecovery = computed(() => {
  if (!cpuLimit.value) return 0
  // В EOSIO CPU восстанавливается примерно 1/3 от максимума каждые 24 часа
  // Это упрощенная оценка
  const recoveryRate = max.value / 3 / 86400 // микросекунд в секунду
  const neededRecovery = max.value - available.value
  return neededRecovery / recoveryRate
})

const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toString()
}

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return t('powerup.cpuResourceWidget.daysHours', { days, hours: hours % 24 })
  } else if (hours > 0) {
    return t('powerup.cpuResourceWidget.hoursMinutes', { hours, minutes })
  } else {
    return t('powerup.cpuResourceWidget.minutes', { minutes })
  }
}
</script>

<style lang="scss" scoped>
@use './../../../shared/resource-card.scss';

.resource-card__icon {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
</style>
