<script setup lang="ts">
import { ref, computed } from 'vue'
import { TariffCard, type ITariff } from './index'
import { t as i18nT } from 'src/shared/i18n';

// Доступные тарифы
const availableTariffs: ITariff[] = [
  {
    id: 'test',
    name: i18nT('connectionAgreementStepper.tariffSelector.testTariffName'),
    description: i18nT('connectionAgreementStepper.tariffSelector.testTariffDescription'),
    price: '1500 RUB',
    features: [
      i18nT('connectionAgreementStepper.tariffSelector.featureAxon'),
      i18nT('connectionAgreementStepper.tariffSelector.featureDocPackages'),
      i18nT('connectionAgreementStepper.tariffSelector.featureRegistrations'),
      i18nT('connectionAgreementStepper.tariffSelector.featureHosting'),
      i18nT('connectionAgreementStepper.tariffSelector.featureSupport')
    ],
    additionalCosts: [
      i18nT('connectionAgreementStepper.tariffSelector.costDaily'),
      i18nT('connectionAgreementStepper.tariffSelector.costPerDocPackage'),
      i18nT('connectionAgreementStepper.tariffSelector.costPerRegistration'),
    ]
  }
]

const props = defineProps<{
  disabled?: boolean
  selectedTariff?: ITariff | null
}>()

const emits = defineEmits<{
  tariffSelected: [tariff: ITariff]
  tariffDeselected: []
}>()

const selectedTariffId = ref<string>(props.selectedTariff?.id || '')

const currentSelectedTariff = computed(() => {
  return availableTariffs.find(tariff => tariff.id === selectedTariffId.value)
})

const handleTariffSelect = (tariffId: string) => {
  selectedTariffId.value = tariffId
  const tariff = availableTariffs.find(t => t.id === tariffId)
  if (tariff) {
    emits('tariffSelected', tariff)
  }
}

const handleTariffDeselect = (tariffId: string) => {
  if (selectedTariffId.value === tariffId) {
    selectedTariffId.value = ''
    emits('tariffDeselected')
  }
}

// Экспортируем для использования в родительском компоненте
defineExpose({
  currentSelectedTariff,
  hasSelection: computed(() => !!selectedTariffId.value)
})
</script>

<template lang="pug">
div
  .text-center.q-mb-lg
    //- h5.text-h5.q-mb-sm Выберите тариф
    p.text-body2.text-grey-7 {{ $t('connectionAgreementStepper.tariffSelector.subtitle') }}

  .tariff-grid
    div(v-for="tariff in availableTariffs" :key="tariff.id")
      TariffCard(
        :tariff="tariff"
        :selected="selectedTariffId === tariff.id"
        :disabled="disabled"
        @select="handleTariffSelect"
        @deselect="handleTariffDeselect"
      )</template>

<style scoped>
.tariff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 599px) {
  .tariff-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
