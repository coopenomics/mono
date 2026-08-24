<script setup lang="ts">
import { computed } from 'vue'
import { TariffSelector, type ITariff } from '../Tariffs'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
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
  title="Выберите конфигурацию сервера"
  lead="Конфигурация определяет ежемесячную плату за хостинг вашей копии платформы — по действующему каталогу провайдера. Списывается членскими взносами с кошелька кооператива."
  :can-back="system.info.is_unioned"
  :next-disabled="!canContinue"
  @back="handleBack"
  @next="handleContinue"
)
  TariffSelector(
    :selected-tariff="selectedTariff"
    @tariff-selected="handleTariffSelected"
  )
</template>
