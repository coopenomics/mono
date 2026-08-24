<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BaseRadioCard, BaseButton } from 'src/shared/ui/base'
import type { ITariff } from 'src/entities/ConnectionAgreement'
import { useConnectionCatalog } from 'src/features/Provider/model'

/**
 * Epic 28 (форм-фактор §7): выбор конфигурации сервера из живого каталога
 * провайдера — цена, характеристики и триал приходят из
 * getProviderConnectionCatalog, хардкода тарифов больше нет.
 */
const props = defineProps<{
  disabled?: boolean
  selectedTariff?: ITariff | null
}>()

const emits = defineEmits<{
  tariffSelected: [tariff: ITariff]
}>()

const { isLoading, error, load, serverTariffs, mandatoryServices, formatPrice } =
  useConnectionCatalog()

const selectedTariffId = ref<string>(props.selectedTariff?.id || '')

const currentSelectedTariff = computed(() =>
  serverTariffs.value.find((tariff) => tariff.id === selectedTariffId.value),
)

const handleTariffSelect = (tariffId: string) => {
  selectedTariffId.value = tariffId
  const tariff = serverTariffs.value.find((t) => t.id === tariffId)
  if (tariff) emits('tariffSelected', tariff)
}

// Если конфигурация одна и ничего ещё не выбрано — отмечаем сразу: экран с
// единственной опцией не должен требовать лишнего клика.
const autoselect = () => {
  if (!selectedTariffId.value && serverTariffs.value.length === 1) {
    handleTariffSelect(serverTariffs.value[0].id)
  }
}
watch(serverTariffs, autoselect)
onMounted(async () => {
  await load()
  autoselect()
})

defineExpose({
  currentSelectedTariff,
  hasSelection: computed(() => !!selectedTariffId.value),
})
</script>

<template lang="pug">
.tariff-selector
  //- Каталог грузится с бэкенда провайдера — показываем скелетон, не пустоту.
  .tariff-selector__list(v-if="isLoading")
    q-skeleton(v-for="i in 2" :key="i" type="rect" height="96px")
  .tariff-selector__error(v-else-if="error")
    p.t-sm {{ error }}
    BaseButton(flat color="primary" label="Повторить" @click="load(true)")
  template(v-else)
    .tariff-selector__list
      BaseRadioCard(
        v-for="tariff in serverTariffs"
        :key="tariff.id"
        :model-value="selectedTariffId || null"
        :value="tariff.id"
        :title="tariff.name"
        :description="tariff.specs"
        :disabled="disabled"
        @update:model-value="handleTariffSelect(tariff.id)"
      )
        template(#meta)
          span.t-mono.t-num {{ tariff.price }}
          span.tariff-selector__period  / мес
          template(v-if="tariff.trialDays")
            span.tariff-selector__period  · первые {{ tariff.trialDays }} дн. — 0 ₽
    //- Обязательные услуги (например, членские за ЭДО) — отдельными взносами.
    .tariff-selector__includes(v-if="mandatoryServices.length")
      p.t-sm.t-muted В подключение также входит:
      ul.tariff-selector__includes-list
        li.t-sm(v-for="svc in mandatoryServices" :key="svc.id")
          | {{ svc.name }} — 
          span.t-mono.t-num {{ formatPrice(svc.price) }} ₽
          |  / {{ svc.period_days }} дн.
</template>

<style scoped>
.tariff-selector__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 320px));
  gap: var(--p-3);
  align-items: stretch;
}
.tariff-selector__period {
  color: var(--p-ink-2);
}
.tariff-selector__error {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  color: var(--p-ink-2);
}
.tariff-selector__includes {
  margin-top: var(--p-4);
}
.tariff-selector__includes-list {
  margin: var(--p-1) 0 0;
  padding-left: var(--p-4);
  color: var(--p-ink-2);
}
</style>
