<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { env } from 'src/shared/config'
import { loadYandexMaps } from 'src/shared/lib/yandexMaps'

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
  /** Подпись на метке (название места); без подписи — крупная метка-«капля». */
  caption?: string
}>()

/** Экранирование подписи: содержимое метки — HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

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
  // Метка того же вида, что выбранный участок в окне выбора пункта выдачи:
  // крупная тёмно-зелёная, с названием места, если оно передано. Прежняя
  // картинка 24×32 терялась на карте (замечание владельца 19.11.2026).
  const placemark = new ymapsRef.Placemark(
    center(),
    props.caption ? { iconContent: escapeHtml(props.caption) } : {},
    { preset: props.caption ? 'islands#darkGreenStretchyIcon' : 'islands#darkGreenIcon' },
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
  () => [props.lat, props.long, props.caption],
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
  .banner__body {{ $t('ui.map.unavailableText') }}
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
