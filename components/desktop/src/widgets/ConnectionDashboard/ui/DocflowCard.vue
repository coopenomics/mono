<template lang="pug">
//- Подписка на документооборот словами, которыми кооператив думает: объём
//- месяца в пайщиках и пакетах документов, остаток месяца, плата. AXON —
//- мелкой подписью: это единица учёта, а не предмет интереса кооператива (27.10.2026).
BaseCard(
  v-if="docflow"
  :title="$t('connectionDashboard.docflowCard.title')"
  :subtitle="tariffName"
)
  .docflow-card
    DataRow(
      align="spread"
      :label="$t('connectionDashboard.docflowCard.volume')"
      :value="volumeLine"
    )
    DataRow(
      align="spread"
      :label="$t('connectionDashboard.docflowCard.remaining')"
      :value="remainingLine"
    )
    DataRow(
      align="spread"
      :label="$t('connectionDashboard.docflowCard.fee')"
      :value="feeLine"
    )
    DataRow(
      v-if="overLimitLine"
      align="spread"
      :label="$t('connectionDashboard.docflowCard.overLimit')"
      :value="overLimitLine"
    )
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { BaseCard } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useConnectionCatalog, useProviderSubscriptions } from 'src/features/Provider/model'
import { AXON_PRICE_RUB, AXON_QUANT, QUANT_PRICE_RUB, tariffVolumeBreakdown } from 'src/shared/lib/axon'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { t } from 'src/shared/i18n'

const session = useSessionStore()
const system = useSystemStore()
const { subscriptions } = useProviderSubscriptions()
const { currentTariff, load: loadCatalog } = useConnectionCatalog()

// Имя тарифа сетки — из каталога провайдера с именем кооператива.
// realtime: нет источника — тариф и подписки ведёт сервер провайдера (другой узел), в ленте кооператива их нет.
onMounted(() => {
  void loadCatalog(true, session.username)
})

/** Пакетная подписка на документооборот: объём месяца приходит в AXON. */
const docflow = computed(() => subscriptions.value.find((s) => String((s as { kind?: string }).kind ?? '') === 'package') ?? null)

const tariffName = computed(() =>
  currentTariff.value ? t('connectionDashboard.subscriptionsCard.planName', { name: currentTariff.value.name }) : '',
)

/** Объём месяца в AXON: из тарифа сетки, иначе из цены подписки по курсу. */
const volumeAxon = computed(() => {
  const fromTariff = Number(currentTariff.value?.docflowAxon ?? 0)
  if (fromTariff > 0) return fromTariff
  return Number((docflow.value as { price?: number | string } | null)?.price ?? 0) / AXON_PRICE_RUB
})

/** Остаток месяца — текущий баланс AXON кооператива. */
const remainingAxon = computed(() => {
  const raw = session.blockchainAccount?.core_liquid_balance || '0'
  return Number.parseFloat(String(raw).replace(/[^\d.-]/g, '')) || 0
})

const axonCount = (value: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)

const capacityLine = (axon: number): string => {
  const { members, operations } = tariffVolumeBreakdown(axon)
  return t('connectionDashboard.docflowCard.capacity', { members, operations, axon: axonCount(axon) })
}
const volumeLine = computed(() => capacityLine(volumeAxon.value))
const remainingLine = computed(() => capacityLine(remainingAxon.value))

const formatPrice = (price: number | string): string =>
  formatAsset2Digits(`${String(price)} ${system.info.symbols?.root_govern_symbol || 'RUB'}`)

const feeLine = computed(() =>
  t('connectionDashboard.subscriptionsCard.pricePerMonth', {
    price: formatPrice(Number((docflow.value as { price?: number | string } | null)?.price ?? 0)),
  }),
)

/** Правило сверх объёма — только если провайдер прислал порог. */
const overLimitLine = computed(() => {
  const threshold = Number((docflow.value as { package_low_water_axon?: number } | null)?.package_low_water_axon ?? 0)
  if (!Number.isFinite(threshold) || threshold <= 0) return ''
  return t('connectionDashboard.docflowCard.overLimitLine', { price: formatPrice(QUANT_PRICE_RUB), quant: AXON_QUANT, threshold })
})
</script>

<style scoped>
.docflow-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
</style>
