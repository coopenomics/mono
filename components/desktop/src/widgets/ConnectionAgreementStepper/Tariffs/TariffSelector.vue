<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BaseRadioCard, BaseButton } from 'src/shared/ui/base'
import type { ITariff } from 'src/entities/ConnectionAgreement'
import { useConnectionCatalog } from 'src/features/Provider/model'
import { DOCUMENT_PACKAGE_PRICE_RUB, MEMBER_PRICE_RUB } from 'src/shared/lib/axon'

/**
 * Epic 28 (форм-фактор §7): выбор тарифа из живого каталога провайдера — цена,
 * характеристики и триал приходят из getProviderConnectionCatalog.
 *
 * Карточка тарифа отвечает на два вопроса: как называется и сколько стоит.
 * Характеристики сервера — мелкой строкой для тех, кому они нужны.
 * Обязательные услуги идут одной строкой под тарифами, правила их расхода —
 * в подсказке. Итог за месяц показывает шаг рядом с кнопкой «Дальше».
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
// realtime: нет источника — каталог тарифов отдаёт провайдер (другой узел), в ленте кооператива его нет.
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
  .tariff-selector__grid(v-if="isLoading")
    q-skeleton(v-for="i in 4" :key="i" type="rect" height="128px")
  .tariff-selector__error(v-else-if="error")
    p.t-sm {{ error }}
    BaseButton(flat color="primary" :label="$t('common.action.retry')" @click="load(true)")
  template(v-else)
    .tariff-selector__grid
      BaseRadioCard(
        v-for="tariff in serverTariffs"
        :key="tariff.id"
        :model-value="selectedTariffId || null"
        :value="tariff.id"
        :title="tariff.name"
        :disabled="disabled"
        @update:model-value="handleTariffSelect(tariff.id)"
      )
        .tariff-card__price
          span.tariff-card__amount {{ tariff.price }}
          span.tariff-card__period {{ $t('connectionAgreementStepper.tariffSelector.perMonth') }}
        template(#meta)
          span.tariff-card__specs {{ tariff.specs }}
    //- Обязательные услуги входят в каждое подключение — одной строкой.
    .tariff-selector__extra(v-for="svc in mandatoryServices" :key="svc.id")
      q-icon(name="add" size="16px")
      span {{ svc.name }}
      span.tariff-selector__extra-price {{ formatPrice(svc.price) }} ₽ {{ $t('connectionAgreementStepper.tariffSelector.perMonth') }}
      q-icon.tariff-selector__hint(name="info_outline" size="16px" tabindex="0")
        q-tooltip(max-width="320px") {{ $t('connectionAgreementStepper.tariffSelector.docflowHint', { memberPrice: MEMBER_PRICE_RUB, packagePrice: DOCUMENT_PACKAGE_PRICE_RUB }) }}
</template>

<style scoped>
.tariff-selector__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--p-3);
  align-items: stretch;
}
/* Цена — самое крупное в карточке: тариф выбирают по ней. */
.tariff-card__price {
  display: flex;
  align-items: baseline;
  gap: var(--p-1);
  margin-top: var(--p-2);
}
.tariff-card__amount {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
}
.tariff-card__period {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.tariff-card__specs {
  font-size: var(--p-fs-meta);
  font-weight: 400;
  color: var(--p-ink-3);
}
.tariff-selector__error {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  color: var(--p-ink-2);
}
.tariff-selector__extra {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-4);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.tariff-selector__extra-price {
  color: var(--p-ink);
  font-weight: 500;
  font-feature-settings: 'tnum' 1;
}
.tariff-selector__hint {
  color: var(--p-ink-3);
  cursor: help;
}
</style>
