<template lang="pug">
.ku-map-with-list(role="region" :aria-label="ariaLabel")
  .ku-map-with-list__list
    q-list(v-if="!loading" separator)
      q-item(
        v-for="pvz in items"
        :key="pvz.coreBraname"
        clickable
        :active="selectedBraname === pvz.coreBraname"
        :class="cardClass(pvz)"
        :aria-current="selectedBraname === pvz.coreBraname ? 'true' : 'false'"
        @click="onSelectFromList(pvz)"
      )
        q-item-section
          q-item-label.text-weight-medium {{ displayName(pvz) }}
          q-item-label(caption, v-if="pvz.name && pvz.addressFull") {{ pvz.addressFull }}
          q-item-label(v-if="pvz.geocodeStatus !== 'OK'" caption :class="geocodeWarnClass(pvz)") {{ geocodeWarnText(pvz) }}
        q-item-section(side top v-if="$slots.cardAction")
          slot(name="cardAction" :pvz="pvz")
    q-skeleton(v-else type="rect" height="200px")

  .ku-map-with-list__map(ref="mapContainer" v-if="apiKey" :style="mapMinHeight ? { minHeight: mapMinHeight } : undefined")
  q-banner.bg-warning.text-white(v-else)
    | Карта недоступна: не задан YANDEX_MAPS_API_KEY.
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { env } from 'src/shared/config'
import { loadYandexMaps } from 'src/shared/lib/yandexMaps'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'

const props = withDefaults(
  defineProps<{
    items: IMarketplaceKUDetails[]
    loading?: boolean
    selectedBraname?: string | null
    ariaLabel?: string
    // Переопределение min-height карты. По умолчанию (undefined) высота берётся
    // из scss (480px десктоп / 320px мобайл). Передаётся, когда карта должна
    // занять больше места — напр. в развёрнутом на весь экран диалоге смены КУ.
    mapMinHeight?: string
  }>(),
  {
    loading: false,
    selectedBraname: null,
    ariaLabel: 'Список пунктов выдачи Стола заказов',
    mapMinHeight: undefined,
  }
)

const emit = defineEmits<{
  (e: 'select', pvz: IMarketplaceKUDetails): void
}>()

const apiKey = (env as unknown as { YANDEX_MAPS_API_KEY?: string }).YANDEX_MAPS_API_KEY ?? ''

const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null
let placemarks: Map<string, any> = new Map()
// Yandex-карта не реагирует на изменение размера своего контейнера сама: при
// смене ширины (флекс/грид-лейаут, скрытие сайдбара, HMR) тайлы и маркеры
// «съезжают» или пропадают, пока не вызвать container.fitToViewport(). Следим
// за контейнером и рефлоуим карту.
let resizeObserver: ResizeObserver | null = null

const visibleItems = computed(() =>
  props.items.filter((pvz) => pvz.geocodeStatus === 'OK' && pvz.lat !== null && pvz.lng !== null)
)

// Человеческое имя КУ для показа: braname (служебный account-id) пользователю
// не показываем НИКОГДА — только настоящее имя участка, затем адрес как фолбэк.
function displayName(pvz: IMarketplaceKUDetails): string {
  return pvz.name || pvz.addressFull || 'Кооперативный участок'
}

function cardClass(pvz: IMarketplaceKUDetails): string {
  if (pvz.status === 'INACTIVE') return 'ku-map-with-list__item--inactive'
  return ''
}

function geocodeWarnClass(pvz: IMarketplaceKUDetails): string {
  return pvz.geocodeStatus === 'FAILED' ? 'text-negative' : 'text-warning'
}

function geocodeWarnText(pvz: IMarketplaceKUDetails): string {
  if (pvz.geocodeStatus === 'PENDING') return 'Координаты не определены — повторите позже'
  if (pvz.geocodeStatus === 'FAILED') {
    return pvz.geocodeErrorMessage
      ? `Ошибка геокодинга: ${pvz.geocodeErrorMessage}`
      : 'Ошибка геокодинга'
  }
  return ''
}

function onSelectFromList(pvz: IMarketplaceKUDetails) {
  emit('select', pvz)
  if (mapInstance && pvz.lat !== null && pvz.lng !== null) {
    // При выборе КУ приближаем на 2 единицы относительно текущего зума
    // (центрируясь на участке), но не глубже 18.
    const current = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 12
    const zoom = Math.min(current + 2, 18)
    mapInstance.setCenter([pvz.lat!, pvz.lng!], zoom, { duration: 300 })
    const pm = placemarks.get(pvz.coreBraname)
    pm?.balloon.open()
  }
}

async function initMap() {
  if (!apiKey || !mapContainer.value) return
  try {
    const ymaps = await loadYandexMaps(apiKey)
    const points = visibleItems.value
    const center: [number, number] = points[0]
      ? [points[0].lat!, points[0].lng!]
      : [55.755826, 37.617299]
    mapInstance = new ymaps.Map(mapContainer.value, {
      center,
      zoom: points.length > 0 ? 10 : 4,
      controls: ['zoomControl', 'fullscreenControl'],
    })
    syncPlacemarks(ymaps)
    // Рефлоу карты при любом изменении размера контейнера (смена ширины
    // лейаута, скрытие меню, HMR) — иначе тайлы/маркеры не перерисовываются.
    if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
      resizeObserver = new ResizeObserver(() => {
        mapInstance?.container.fitToViewport()
      })
      resizeObserver.observe(mapContainer.value)
    }
  } catch (err) {
    console.warn('[KUMapWithList] Yandex Maps init упал:', err)
  }
}

function syncPlacemarks(ymaps: any) {
  if (!mapInstance) return
  placemarks.forEach((pm) => mapInstance.geoObjects.remove(pm))
  placemarks = new Map()
  for (const pvz of visibleItems.value) {
    const pm = new ymaps.Placemark(
      [pvz.lat!, pvz.lng!],
      {
        balloonContent: `<strong>${displayName(pvz)}</strong><br>${pvz.addressFull ?? ''}`,
        hintContent: displayName(pvz),
      },
      { preset: pvz.status === 'INACTIVE' ? 'islands#grayDotIcon' : 'islands#blueDotIcon' }
    )
    pm.events.add('click', () => emit('select', pvz))
    mapInstance.geoObjects.add(pm)
    placemarks.set(pvz.coreBraname, pm)
  }
  // Одна точка: setBounds на bbox из одной точки зумит в максимум («упёрся
  // носом в дом») — центрируем на ней с городским зумом. Несколько точек —
  // подгоняем границы под все. Ноль — оставляем дефолтный центр (Москва).
  if (visibleItems.value.length === 1) {
    const p = visibleItems.value[0]!
    mapInstance.setCenter([p.lat!, p.lng!], 12, { duration: 300 })
  } else if (visibleItems.value.length > 1) {
    mapInstance.setBounds(mapInstance.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 })
  }
}

watch(
  () => visibleItems.value,
  () => {
    if (mapInstance && window.ymaps) syncPlacemarks(window.ymaps)
  },
  { deep: true }
)

onMounted(() => {
  void initMap()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance) {
    mapInstance.destroy()
    mapInstance = null
  }
})
</script>

<style lang="scss" scoped>
.ku-map-with-list {
  display: grid;
  grid-template-columns: minmax(260px, 360px) 1fr;
  gap: 16px;

  &__list {
    overflow-y: auto;
    max-height: 70vh;
  }

  &__map {
    min-height: 480px;
    border-radius: 8px;
    overflow: hidden;
  }

  &__item--inactive {
    opacity: 0.6;
  }

  @media (max-width: $breakpoint-sm-max) {
    grid-template-columns: 1fr;

    &__map {
      min-height: 320px;
      order: -1;
    }
  }
}
</style>
