<template lang="pug">
.resource-monitor
  BaseCard(title="Использование ресурсов" subtitle="CPU / NET / RAM текущего кооператива (последний срез PowerupPlugin)")
    Loader(v-if="isLoading" :text="'Загрузка данных...'")

    template(v-else-if="error")
      BaseBanner(variant="neg") Ошибка загрузки ресурсов: {{ error }}

    template(v-else)
      .resource-monitor__grid
        .resource-monitor__item
          .resource-monitor__label CPU
          .resource-monitor__value.t-mono {{ formatPct(cpuPct) }}
          q-linear-progress(
            :value="cpuPct / 100"
            :color="severityColor(cpuPct)"
            size="6px"
            rounded
          )
        .resource-monitor__item
          .resource-monitor__label NET
          .resource-monitor__value.t-mono {{ formatPct(netPct) }}
          q-linear-progress(
            :value="netPct / 100"
            :color="severityColor(netPct)"
            size="6px"
            rounded
          )
        .resource-monitor__item
          .resource-monitor__label RAM
          .resource-monitor__value.t-mono {{ formatPct(ramPct) }}
          q-linear-progress(
            :value="ramPct / 100"
            :color="severityColor(ramPct)"
            size="6px"
            rounded
          )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseBanner, BaseCard } from 'src/shared/ui/base'
import Loader from 'src/shared/ui/Loader/Loader.vue'

interface ResourceUsage {
  cpu_pct: number
  net_pct: number
  ram_pct: number
}

const props = defineProps<{
  usage?: ResourceUsage | null
  isLoading?: boolean
  error?: string | null
}>()

const cpuPct = computed(() => clamp(props.usage?.cpu_pct ?? 0))
const netPct = computed(() => clamp(props.usage?.net_pct ?? 0))
const ramPct = computed(() => clamp(props.usage?.ram_pct ?? 0))

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`
}

// Epic 13 v5.1: severity-цвет по порогу 70% (= PowerupPlugin threshold по умолчанию).
function severityColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}
</script>

<style scoped>
.resource-monitor__grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--p-4);
}
.resource-monitor__item {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.resource-monitor__label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.resource-monitor__value {
  font-size: var(--p-fs-h4);
  font-weight: 700;
  color: var(--p-ink);
}
</style>
