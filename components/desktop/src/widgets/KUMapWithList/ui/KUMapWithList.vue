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
          //- Режим работы: пайщик выбирает пункт выдачи по удобному времени.
          q-item-label.ku-map-with-list__hours(caption, v-if="formatWorkingHours(pvz.workingHours).length")
            q-icon(name="schedule", size="14px")
            span
              span(v-for="line in formatWorkingHours(pvz.workingHours)", :key="line") {{ line }}
          q-item-label(v-if="pvz.geocodeStatus !== 'OK'" caption :class="geocodeWarnClass(pvz)") {{ geocodeWarnText(pvz) }}
        q-item-section(side top v-if="$slots.cardAction")
          slot(name="cardAction" :pvz="pvz")
    q-skeleton(v-else type="rect" height="200px")

  .ku-map-with-list__map(ref="mapContainer" v-if="apiKey" :style="mapMinHeight ? { minHeight: mapMinHeight } : undefined")
  BaseBanner(v-else, variant='warn')
    | {{ $t('kUMapWithList.kUMapWithList.mapUnavailableBanner') }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { env } from 'src/shared/config'
import { BaseBanner } from 'src/shared/ui/base'
import { loadYandexMaps } from 'src/shared/lib/yandexMaps'
import { formatWorkingHours, type IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'
import { t } from 'src/shared/i18n';

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
    ariaLabel: t('kUMapWithList.kUMapWithList.defaultAriaLabel'),
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

/** Масштаб улиц для выбранного участка. */
const SELECTED_ZOOM = 16

/**
 * Отпечаток меток и набора участков. Список участков перечитывается по
 * каждому сигналу ленты изменений; без сравнения карта пересоздавала метки и
 * заново подгоняла масштаб — вид «прыгал» сам (замечание владельца 19.11.2026).
 * Метки перестраиваются, когда изменились их данные, масштаб подгоняется,
 * когда изменился набор участков.
 */
let placemarksSignature = ''
let boundsSignature = ''

function placemarksKey(items: IMarketplaceKUDetails[]): string {
  return items
    .map((p) => [p.coreBraname, p.lat, p.lng, p.status, p.name, p.addressFull, JSON.stringify(p.workingHours ?? {})].join('|'))
    .join(';')
}

function boundsKey(items: IMarketplaceKUDetails[]): string {
  return items.map((p) => `${p.coreBraname}|${p.lat}|${p.lng}`).join(';')
}

const visibleItems = computed(() =>
  props.items.filter((pvz) => pvz.geocodeStatus === 'OK' && pvz.lat !== null && pvz.lng !== null)
)

// Человеческое имя КУ для показа: braname (служебный account-id) пользователю
// не показываем НИКОГДА — только настоящее имя участка, затем адрес как фолбэк.
function displayName(pvz: IMarketplaceKUDetails): string {
  return pvz.name || pvz.addressFull || t('kUMapWithList.kUMapWithList.fallbackBranchName')
}

/** Экранирование текста для подсказки метки: её содержимое — HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/**
 * Подсказка метки: адрес и режим работы. Название стоит на самой метке —
 * в подсказке оно повторялось бы дважды.
 */
function balloonHtml(pvz: IMarketplaceKUDetails): string {
  const lines: string[] = []
  if (pvz.addressFull) lines.push(escapeHtml(pvz.addressFull))
  for (const line of formatWorkingHours(pvz.workingHours)) lines.push(escapeHtml(line))
  return lines.join('<br>')
}

function cardClass(pvz: IMarketplaceKUDetails): string {
  if (pvz.status === 'INACTIVE') return 'ku-map-with-list__item--inactive'
  return ''
}

function geocodeWarnClass(pvz: IMarketplaceKUDetails): string {
  return pvz.geocodeStatus === 'FAILED' ? 'text-negative' : 'text-warning'
}

function geocodeWarnText(pvz: IMarketplaceKUDetails): string {
  if (pvz.geocodeStatus === 'PENDING') return t('kUMapWithList.kUMapWithList.geocodePendingWarning')
  if (pvz.geocodeStatus === 'FAILED') {
    return pvz.geocodeErrorMessage
      ? t('kUMapWithList.kUMapWithList.geocodeErrorWithMessage', { errorMessage: pvz.geocodeErrorMessage })
      : t('kUMapWithList.kUMapWithList.geocodeErrorGeneric')
  }
  return ''
}

function onSelectFromList(pvz: IMarketplaceKUDetails) {
  emit('select', pvz)
  if (mapInstance && pvz.lat !== null && pvz.lng !== null) {
    // Выбранный участок — в центре, масштаб улиц. Масштаб постоянный: прежнее
    // «текущий + 2» копилось, и повторное нажатие на тот же участок уносило
    // карту дальше (замечание владельца 19.11.2026).
    mapInstance.setCenter([pvz.lat!, pvz.lng!], SELECTED_ZOOM, { duration: 300 })
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

/**
 * Вид метки на карте. Каждый участок — метка с его названием (замечание
 * владельца 19.11.2026: маленькая точка терялась на карте, а подсказка над
 * ней «торчала из земли»). Выбранный — тёмно-зелёная, остальные — синие,
 * недействующие — серые.
 */
function placemarkPreset(pvz: IMarketplaceKUDetails): string {
  if (pvz.coreBraname === props.selectedBraname) return 'islands#darkGreenStretchyIcon'
  return pvz.status === 'INACTIVE' ? 'islands#grayStretchyIcon' : 'islands#blueStretchyIcon'
}

/** Выбранная метка идёт поверх соседних — иначе крупная «капля» прячется за точками. */
function placemarkZIndex(pvz: IMarketplaceKUDetails): number {
  return pvz.coreBraname === props.selectedBraname ? 1000 : 100
}

function syncPlacemarks(ymaps: any) {
  if (!mapInstance) return
  const nextPlacemarks = placemarksKey(visibleItems.value)
  if (nextPlacemarks === placemarksSignature) return
  placemarksSignature = nextPlacemarks
  placemarks.forEach((pm) => mapInstance.geoObjects.remove(pm))
  placemarks = new Map()
  for (const pvz of visibleItems.value) {
    const pm = new ymaps.Placemark(
      [pvz.lat!, pvz.lng!],
      {
        balloonContent: balloonHtml(pvz),
        // Название на самой метке: участок виден на карте без наведения.
        iconContent: escapeHtml(displayName(pvz)),
      },
      { preset: placemarkPreset(pvz), zIndex: placemarkZIndex(pvz) }
    )
    pm.events.add('click', () => emit('select', pvz))
    mapInstance.geoObjects.add(pm)
    placemarks.set(pvz.coreBraname, pm)
  }
  // Масштаб — только при первом показе и при смене набора участков: человек
  // мог приблизить карту, и перечитывание списка не должно его сбрасывать.
  const nextBounds = boundsKey(visibleItems.value)
  if (nextBounds === boundsSignature) return
  boundsSignature = nextBounds
  // Одна точка: setBounds на bbox из одной точки зумит в максимум («упёрся
  // носом в дом») — центрируем на ней с городским зумом. То же, когда все
  // участки стоят в одной точке: адрес «Москва» геокодер ставит в центр города,
  // и рамка из совпавших точек тоже нулевая (замечание владельца 19.11.2026).
  // Несколько разных точек — подгоняем границы под все. Ноль — дефолтный центр.
  const distinctPoints = new Set(visibleItems.value.map((p) => `${p.lat}|${p.lng}`))
  if (distinctPoints.size === 1) {
    const p = visibleItems.value[0]!
    mapInstance.setCenter([p.lat!, p.lng!], 12, { duration: 300 })
  } else if (distinctPoints.size > 1) {
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

// Смена выбора перекрашивает метки на месте, без пересоздания: полная
// пересборка сбрасывала бы открытый балун и дёргала карту.
watch(
  () => props.selectedBraname,
  () => {
    for (const pvz of visibleItems.value) {
      const pm = placemarks.get(pvz.coreBraname)
      if (!pm) continue
      pm.options.set('preset', placemarkPreset(pvz))
      pm.options.set('zIndex', placemarkZIndex(pvz))
    }
  }
)

// realtime: нет источника — виджет получает пункты выдачи свойством (у родителя они живут по ленте), при открытии грузит только скрипт карты.
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
.ku-map-with-list__hours {
  display: flex;
  align-items: flex-start;
  gap: var(--p-1);
  margin-top: 2px;
}
.ku-map-with-list__hours > span {
  display: flex;
  flex-direction: column;
}
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

    // Список идёт первым, карта под ним: на узком экране карта сверху занимала
    // весь первый экран, и человек не догадывался, что участок можно просто
    // выбрать из списка — искал по карте, хотя участков всего несколько.
    &__list {
      max-height: 45vh;
    }

    &__map {
      min-height: 320px;
    }
  }
}
</style>
