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
          .powerup-page__row(v-if="pendingPaymentHash")
            .powerup-page__label.text-warning Pending recovery
            .powerup-page__value.t-mono.text-warning ⚠

  .row.q-mt-md(v-if="settingsInitial")
    .col-12
      PowerupSettingsForm(
        :initial="settingsInitial"
        :is-saving="isSaving"
        @submit="onSubmit"
      )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Notify } from 'quasar'
import { BaseCard } from 'src/shared/ui/base'
import { ResourceMonitor } from 'src/widgets/PowerUp/ResourceMonitor'
import { PowerupSettingsForm } from 'src/features/PowerUp/SettingsForm'
import { useExtensionStore } from 'src/entities/Extension/model'
import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'

// Epic 13 v5.1 adversarial round 2: страница больше не «декорация» —
// читает текущий config powerup-extension через useExtensionStore и
// сохраняет изменения через Mutations.Extensions.UpdateExtension.
const POWERUP_NAME = 'powerup'

const extensionStore = useExtensionStore()

const usage = ref<{ cpu_pct: number; net_pct: number; ram_pct: number } | null>(null)
const isLoadingUsage = ref(false)
const usageError = ref<string | null>(null)

const isSaving = ref(false)

const powerup = computed(() =>
  extensionStore.extensions.find((e) => e.name === POWERUP_NAME),
)
const cfg = computed<any>(() => powerup.value?.config ?? null)

const monthSpentRub = computed(() => Number(cfg.value?.todayPackagesIssued ? 0 : 0) || 0)
const monthQuotaRub = computed(() => Number(cfg.value?.monthlyRubCap ?? 0))
const todayPackagesIssued = computed(() => Number(cfg.value?.todayPackagesIssued ?? 0))
const pendingPaymentHash = computed(() => String(cfg.value?.pendingPaymentHash ?? ''))

const settingsInitial = computed(() => {
  if (!cfg.value) return null
  return {
    dailyPackageSize: Number(cfg.value.dailyPackageSize ?? 5),
    thresholds: {
      cpu: Number(cfg.value.thresholds?.cpu ?? 70),
      net: Number(cfg.value.thresholds?.net ?? 70),
      ram: Number(cfg.value.thresholds?.ram ?? 70),
    },
    cooldownMinutes: Number(cfg.value.cooldownMinutes ?? 5),
    dailyAxonCap: Number(cfg.value.dailyAxonCap ?? 50),
    dailyPackageCap: Number(cfg.value.dailyPackageCap ?? 10),
    monthlyRubCap: Number(cfg.value.monthlyRubCap ?? 5000),
  }
})

function formatRub(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

async function onSubmit(value: any): Promise<void> {
  if (!powerup.value) return
  isSaving.value = true
  try {
    const nextConfig = {
      ...(cfg.value ?? {}),
      dailyPackageSize: Number(value.dailyPackageSize),
      thresholds: {
        cpu: Number(value.thresholds.cpu),
        net: Number(value.thresholds.net),
        ram: Number(value.thresholds.ram),
      },
      cooldownMinutes: Number(value.cooldownMinutes),
      dailyAxonCap: Number(value.dailyAxonCap),
      dailyPackageCap: Number(value.dailyPackageCap),
      monthlyRubCap: Number(value.monthlyRubCap),
    }
    const data: Mutations.Extensions.UpdateExtension.IInput['data'] = {
      name: POWERUP_NAME,
      enabled: Boolean(powerup.value.enabled),
      config: nextConfig,
    }
    await client.Mutation(Mutations.Extensions.UpdateExtension.mutation, {
      variables: { data },
    })
    await extensionStore.loadExtensions()
    Notify.create({ type: 'positive', message: 'Настройки PowerUp сохранены' })
  } catch (err: any) {
    Notify.create({
      type: 'negative',
      message: err?.message ?? 'Не удалось сохранить настройки',
    })
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  isLoadingUsage.value = true
  try {
    await extensionStore.loadExtensions()
  } catch (err: any) {
    usageError.value = err?.message ?? 'Не удалось загрузить config расширения'
  } finally {
    isLoadingUsage.value = false
  }
})
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
