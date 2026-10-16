<script setup lang="ts">
import { computed } from 'vue'
import { TariffSelector, type ITariff } from '../Tariffs'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
import { useConnectionCatalog } from 'src/features/Provider/model'
import StepFrame from '../ui/StepFrame.vue'

const props = defineProps<{
  selectedTariff?: ITariff | null
}>()

const connectionAgreement = useConnectionAgreementStore()
const system = useSystemStore()

const selectedTariff = computed({
  get: () => props.selectedTariff || connectionAgreement.selectedTariff,
  set: (value) => connectionAgreement.setSelectedTariff(value),
})

const canContinue = computed(() => selectedTariff.value !== null)

// Итог за месяц — тариф плюс обязательные услуги. Каталог общий с выбором
// тарифа: TariffSelector его загружает, здесь только читаем.
const { monthlyTotal, trialDays, formatPrice } = useConnectionCatalog()
// Тариф сетки несёт цену целиком; конфигурация сервера старого провайдера —
// сервер плюс обязательные услуги.
const total = computed(() => {
  const tariff = selectedTariff.value
  if (!tariff) return null
  if (tariff.monthlyTotal != null) return tariff.monthlyTotal
  return monthlyTotal(tariff.instanceTypeId ?? null)
})

const handleTariffSelected = (tariff: ITariff) => {
  selectedTariff.value = tariff
}

const handleBack = () => connectionAgreement.setCurrentStep(CONNECTION_STEP.union)

const handleContinue = () => {
  if (canContinue.value) connectionAgreement.setCurrentStep(CONNECTION_STEP.domain)
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.introStep.stepTitle')"
  :lead="$t('connectionAgreementStepper.introStep.lead')"
  :can-back="system.info.is_unioned"
  :next-disabled="!canContinue"
  @back="handleBack"
  @next="handleContinue"
)
  TariffSelector(
    :selected-tariff="selectedTariff"
    @tariff-selected="handleTariffSelected"
  )

  template(#aside)
    .intro-total(v-if="total != null")
      .intro-total__sum
        span.intro-total__label {{ $t('connectionAgreementStepper.introStep.totalLabel') }}
        span.intro-total__amount {{ formatPrice(total) }} ₽
        span.intro-total__period {{ $t('connectionAgreementStepper.tariffSelector.perMonth') }}
      .intro-total__note
        template(v-if="trialDays") {{ $t('connectionAgreementStepper.introStep.trialNote', { days: trialDays }) }} ·&nbsp;
        | {{ $t('connectionAgreementStepper.introStep.paymentNote') }}
</template>

<style scoped>
.intro-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
}
.intro-total__sum {
  display: flex;
  align-items: baseline;
  gap: var(--p-2);
}
.intro-total__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.intro-total__amount {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
}
.intro-total__period {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.intro-total__note {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}
</style>
