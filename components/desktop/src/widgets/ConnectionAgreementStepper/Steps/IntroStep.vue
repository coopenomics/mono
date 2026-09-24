<script setup lang="ts">
import { computed } from 'vue'
import type { IStepProps } from '../model/types'
import { TariffSelector, type ITariff } from '../Tariffs'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'

const props = withDefaults(defineProps<IStepProps & {
  selectedTariff?: ITariff | null
}>(), {})

const connectionAgreement = useConnectionAgreementStore()
const system = useSystemStore()

const isActive = computed(() => props.isActive)
const isDone = computed(() => props.isDone)

const selectedTariff = computed({
  get: () => props.selectedTariff || connectionAgreement.selectedTariff,
  set: (value) => connectionAgreement.setSelectedTariff(value)
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
  if (canContinue.value && connectionAgreement.currentStep < 5) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep + 1)
  }
}
</script>

<template lang="pug">
q-step(
  :name="1"
  :title="$t('connectionAgreementStepper.introStep.title')"
  icon="info"
  :done="isDone"
)
  .q-pa-md

    TariffSelector(
      :disabled="!isActive"
      :selected-tariff="selectedTariff"
      @tariff-selected="handleTariffSelected"
      @tariff-deselected="handleTariffDeselected"
    )

  q-stepper-navigation.q-gutter-sm
    q-btn(
      v-if="isActive && system.info.is_unioned"
      color="grey-6"
      flat
      :label="$t('common.action.back')"
      @click="handleBack"
    )
    q-btn(
      v-if="isActive"
      color="primary"
      :disable="!canContinue"
      :label="$t('connectionAgreementStepper.introStep.continueSubmit')"
      @click="handleContinue"
    )
</template>
