<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { env } from 'src/shared/config'
import { loadYandexMaps } from 'src/shared/lib/yandexMaps'
import PinIcon from 'src/assets/pin.svg'

/**
 * Single-point карта на Yandex Maps JS API: показывает одну метку по
 * координатам. Используется в диалогах просмотра адреса (например, карточка
 * ПВЗ на столе администратора).
 *
 * SDK грузится лениво через общий {@link loadYandexMaps}; если ключ
 * YANDEX_MAPS_API_KEY не задан — показывается деградированный баннер.
 */

const props = defineProps<{
  long: number
  lat: number
}>()

const apiKey = env.YANDEX_MAPS_API_KEY

const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null
let ymapsRef: any = null
let resizeObserver: ResizeObserver | null = null

function center(): [number, number] {
  // Yandex принимает координаты в порядке [широта, долгота].
  return [Number(props.lat), Number(props.long)]
}

function renderPlacemark(): void {
  if (!mapInstance || !ymapsRef) return
  mapInstance.geoObjects.removeAll()
  const placemark = new ymapsRef.Placemark(
    center(),
    {},
    {
      iconLayout: 'default#image',
      iconImageHref: PinIcon,
      iconImageSize: [24, 32],
      iconImageOffset: [-12, -32],
    },
  )
  mapInstance.geoObjects.add(placemark)
}

async function initMap(): Promise<void> {
  if (!apiKey || !mapContainer.value) return
  try {
    ymapsRef = await loadYandexMaps(apiKey)
    await nextTick()
    if (!mapContainer.value) return
    mapInstance = new ymapsRef.Map(mapContainer.value, {
      center: center(),
      zoom: 17,
      controls: ['zoomControl', 'fullscreenControl'],
    })
    renderPlacemark()

    // Внутри диалога контейнер на момент монтирования может иметь нулевой
    // размер (анимация раскрытия) — подгоняем карту под вьюпорт по ресайзу.
    resizeObserver = new ResizeObserver(() => {
      mapInstance?.container.fitToViewport()
    })
    resizeObserver.observe(mapContainer.value)
  } catch (err) {
    console.warn('[Map] Yandex Maps init упал:', err)
  }
}

watch(
  () => [props.lat, props.long],
  () => {
    if (mapInstance) {
      mapInstance.setCenter(center(), 17)
      renderPlacemark()
    }
  },
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

<template lang="pug">
.ya-map(v-if="apiKey" ref="mapContainer")
.banner.banner--warn(v-else)
  q-icon.banner__icon(name="warning" size="18px")
  .banner__body Карта недоступна: не задан ключ Яндекс.Карт.
</template>

<style scoped lang="scss">
.ya-map {
  width: 100%;
  height: 300px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;
}
</style>
