<template lang="pug">
.mp-ku-selector
  EmptyState(
    v-if="!skeleton && !details.length",
    :title="$t('marketplace.kuSelector.emptyTitle')",
    :body="$t('marketplace.kuSelector.emptyBody')"
  )
    template(#icon)
      q-icon(name="location_off", size="26px")
  KUMapWithList(
    v-else,
    :items="details",
    :loading="skeleton",
    :selected-braname="modelValue",
    :map-min-height="mapMinHeight",
    :aria-label="$t('marketplace.kuSelector.ariaLabel')",
    @select="onSelect",
    @confirm="onConfirm"
  )
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { FailAlert } from 'src/shared/api'
import { EmptyState } from 'src/shared/ui/base'
import { useFirstLoad } from 'src/shared/lib/composables'
import { KUMapWithList } from 'src/widgets/KUMapWithList'
import {
  useMarketplaceKUDetailsStore,
  type IMarketplaceKUDetails,
} from 'src/entities/MarketplaceKUDetails'
import { t } from 'src/shared/i18n';

/**
 * Эпик 16 / Story 16.4: выбор кооперативного участка (ПВЗ) заказчиком.
 *
 * Заказчик выбирает КУ из списка и видит его на карте (виджет KUMapWithList).
 * Используется в двух местах: на экране подписания оферты (первичный выбор КУ,
 * Story 1.11) и в шапке стола (смена КУ). Сам по себе ничего не сохраняет —
 * только эмитит выбранный `braname` через v-model; персист (setCartDeliveryPoint)
 * делает родитель, т.к. он зависит от контекста (до/после подписи оферты).
 */
const props = defineProps<{
  coopname: string
  /** Выбранный braname (v-model). */
  modelValue: string | null
  /** Переопределение min-height карты (см. KUMapWithList.mapMinHeight). */
  mapMinHeight?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', braname: string): void
  /** Повторное нажатие на выбранный участок — родитель применяет выбор. */
  (e: 'confirm', braname: string): void
}>()

const kuStore = useMarketplaceKUDetailsStore()
// Только активные КУ: заказчику нельзя выбрать выключенный пункт выдачи.
const details = computed(() => kuStore.details.filter((d) => d.status !== 'INACTIVE'))
// Скелетон — только пока участков ещё нет. Список перечитывается при каждом
// открытии окна и по каждому сигналу ленты; раньше любая дочитка заменяла
// готовый список скелетоном, и участки «прыгали» (замечание владельца 19.11.2026).
const firstLoad = useFirstLoad(() => kuStore.isLoading)
const skeleton = computed(() => firstLoad.value && !kuStore.details.length)

function onSelect(pvz: IMarketplaceKUDetails): void {
  emit('update:modelValue', pvz.coreBraname)
}

function onConfirm(pvz: IMarketplaceKUDetails): void {
  emit('update:modelValue', pvz.coreBraname)
  emit('confirm', pvz.coreBraname)
}

onMounted(async () => {
  try {
    await kuStore.load({ coopname: props.coopname, onlyActive: true })
  } catch (e) {
    FailAlert(e, t('marketplace.kuSelector.loadError'))
  }
})

// Список пунктов выдачи и карта живут по ленте: участки и их детали
// перечитываются сами.
useLiveReload(marketLiveTables('ku'), () => kuStore.load({ coopname: props.coopname, onlyActive: true }))
</script>

<style scoped lang="scss">
.mp-ku-selector {
  width: 100%;
}
</style>
