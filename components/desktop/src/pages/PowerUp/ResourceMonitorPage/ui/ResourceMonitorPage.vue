<template lang="pug">
.powerup-page.q-pa-md
  .row.q-col-gutter-md
    .col-12.col-md-8
      ResourceMonitor(:usage="usage" :is-loading="isLoadingUsage" :error="usageError")
    .col-12.col-md-4
      BaseCard(title="Сводка пакета" subtitle="Текущий период")
        .powerup-page__summary
          .powerup-page__row
            .powerup-page__label Докуплено в этом месяце
            .powerup-page__value.t-mono {{ formatRub(monthSpentRub) }}
          .powerup-page__row
            .powerup-page__label Потолок месяца
            .powerup-page__value.t-mono {{ formatRub(monthQuotaRub) }}
          .powerup-page__row
            .powerup-page__label Сделано пакетов сегодня
            .powerup-page__value.t-mono {{ todayPackagesIssued }}

  .row.q-mt-md
    .col-12
      PowerupSettingsForm(
        :initial="settingsInitial"
        :is-saving="isSaving"
        @submit="onSubmit"
      )
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BaseCard } from 'src/shared/ui/base'
import { ResourceMonitor } from 'src/widgets/PowerUp/ResourceMonitor'
import { PowerupSettingsForm } from 'src/features/PowerUp/SettingsForm'

// Epic 13 v5.1: на старте — пустой стейт, реальная загрузка через GraphQL
// extension-config (Mutations.Extension.Update) делается на стороне store'а.
// Скаффолдинг страницы покрывает FSD-layout и интегрирует виджет + форму.
const usage = ref<{ cpu_pct: number; net_pct: number; ram_pct: number } | null>(null)
const isLoadingUsage = ref(false)
const usageError = ref<string | null>(null)

const monthSpentRub = ref(0)
const monthQuotaRub = ref(0)
const todayPackagesIssued = ref(0)

const isSaving = ref(false)
const settingsInitial = computed(() => ({
  dailyPackageSize: 5,
  thresholds: { cpu: 70, net: 70, ram: 70 },
  cooldownMinutes: 5,
  dailyAxonCap: 50,
  dailyPackageCap: 10,
  monthlyRubCap: 5000,
}))

function formatRub(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

function onSubmit(_value: any): void {
  // TODO: дёрнуть Mutations.Extension.Update через @coopenomics/sdk
  // с config-объектом из формы; после успеха — обновить локальный стейт.
  isSaving.value = false
}
</script>

<style scoped>
.powerup-page__summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.powerup-page__row {
  display: flex;
  justify-content: space-between;
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
}
.powerup-page__row:last-child {
  border-bottom: 0;
}
.powerup-page__label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
}
.powerup-page__value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
