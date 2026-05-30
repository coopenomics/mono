<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TariffCard, type ITariff } from './index'

const availableTariffs: ITariff[] = [
  {
    id: 'base',
    name: 'Базовый',
    description: 'Подключение кооператива к платформе Кооперативной Экономики',
    price: '3 000 ₽',
    features: [
      '50 пакетов документов в месяц',
      '50 регистраций пайщика в месяц',
      'Хостинг на изолированном сервере',
      'Техническая поддержка',
    ],
  },
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

const currentSelectedTariff = computed(() =>
  availableTariffs.find((tariff) => tariff.id === selectedTariffId.value),
)

const handleTariffSelect = (tariffId: string) => {
  selectedTariffId.value = tariffId
  const tariff = availableTariffs.find((t) => t.id === tariffId)
  if (tariff) emits('tariffSelected', tariff)
}

const handleTariffDeselect = (tariffId: string) => {
  if (selectedTariffId.value === tariffId) {
    selectedTariffId.value = ''
    emits('tariffDeselected')
  }
}

// Если тариф один и ничего ещё не выбрано — отмечаем сразу. Канон-степпер
// предполагает что пользователь делает явный выбор; экран с единственной
// опцией не должен требовать лишнего клика.
onMounted(() => {
  if (!selectedTariffId.value && availableTariffs.length === 1) {
    handleTariffSelect(availableTariffs[0].id)
  }
})

defineExpose({
  currentSelectedTariff,
  hasSelection: computed(() => !!selectedTariffId.value),
})
</script>

<template lang="pug">
.tariff-selector
  .tariff-selector__list
    TariffCard(
      v-for="tariff in availableTariffs"
      :key="tariff.id"
      :tariff="tariff"
      :selected="selectedTariffId === tariff.id"
      :disabled="disabled"
      group-name="connection-tariff"
      @select="handleTariffSelect"
      @deselect="handleTariffDeselect"
    )
</template>

<style scoped>
.tariff-selector__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 300px));
  gap: var(--p-4);
  align-items: stretch;
}
</style>
