<template>
  <q-carousel
    v-if="images.length"
    v-model="slide"
    class="offer-gallery"
    swipeable
    animated
    infinite
    transition-prev="slide-right"
    transition-next="slide-left"
    :arrows="images.length > 1 && arrows"
    :navigation="images.length > 1 && navigation"
    control-color="primary"
    :height="height"
    @click.stop
  >
    <q-carousel-slide
      v-for="(img, i) in images"
      :key="img"
      :name="i"
      class="offer-gallery__slide"
    >
      <!-- no-spinner: подписанные URL'ы стабильны на бэкенде (окно getReadUrl),
           src не меняется при polling — лоудер только мигал бы. -->
      <q-img :src="img" :alt="alt" :fit="fit" no-spinner @click="emit('image-click')" />
    </q-carousel-slide>
  </q-carousel>
  <div v-else class="offer-gallery__placeholder">
    <q-icon name="image" :size="placeholderIconSize" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/**
 * Галерея изображений оферты Стола заказов — единая карусель для всех экранов,
 * где показываются картинки товара: карточка каталога (`CatalogOfferCard`),
 * страница предложения (`MarketplaceOfferDetail`) и деталь заказа
 * (`OrdererOrderDetail`). Раньше карусель верстали inline в каждом — нарушение
 * DRY; теперь один компонент, которому передают `images` (готовые URL'ы из
 * `marketplaceOfferImageUrls`). Размер задаёт родитель через `height` (или
 * через размеры обёртки при `height="100%"`).
 */

withDefaults(
  defineProps<{
    /** Готовые URL'ы изображений (обложка первой). Пусто → плейсхолдер. */
    images: string[]
    /** Высота карусели: фикс ('360px') или '100%' под размер обёртки. */
    height?: string
    arrows?: boolean
    /**
     * Точки-навигация снизу. По умолчанию выключены — точки в галерее товара
     * не нужны (листается свайпом/стрелками), их явно убрали по всем экранам.
     */
    navigation?: boolean
    alt?: string
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
    placeholderIconSize?: string
  }>(),
  {
    height: '100%',
    arrows: true,
    navigation: false,
    alt: '',
    fit: 'cover',
    placeholderIconSize: '48px',
  },
)

// Клик по изображению (карточка каталога открывает по нему страницу оферты).
// Стрелки/навигацию карусели гасит `@click.stop` на самой ленте.
const emit = defineEmits<{ (e: 'image-click'): void }>()

const slide = ref(0)
</script>

<style scoped lang="scss">
.offer-gallery {
  width: 100%;
  height: 100%;
  border-radius: inherit;

  :deep(.q-carousel__slide) {
    padding: 0;
  }

  :deep(.q-img) {
    width: 100%;
    height: 100%;
  }

  &__slide {
    padding: 0;
  }
}

.offer-gallery__placeholder {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
  background: var(--p-surface-2);
}
</style>
