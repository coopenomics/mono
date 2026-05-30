<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton } from 'src/shared/ui/base/BaseButton'
import { TariffSelector, type ITariff } from '../Tariffs'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'

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

const handleTariffSelected = (tariff: ITariff) => {
  selectedTariff.value = tariff
}

const handleTariffDeselected = () => {
  selectedTariff.value = null
}

const handleBack = () => {
  if (system.info.is_unioned) {
    connectionAgreement.setCurrentStep(0)
  }
}

const handleContinue = () => {
  if (canContinue.value && connectionAgreement.currentStep < 7) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep + 1)
  }
}
</script>

<template lang="pug">
.intro-step
  TariffSelector(
    :selected-tariff="selectedTariff"
    @tariff-selected="handleTariffSelected"
    @tariff-deselected="handleTariffDeselected"
  )
  .intro-step__actions
    BaseButton(
      v-if="system.info.is_unioned"
      variant="ghost"
      size="sm"
      @click="handleBack"
    ) Назад
    .intro-step__spacer
    BaseButton(
      variant="primary"
      size="sm"
      :disabled="!canContinue"
      @click="handleContinue"
    ) Дальше
</template>

<style scoped>
.intro-step {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
.intro-step__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
.intro-step__spacer {
  flex: 1 1 auto;
}
</style>
