<template>
  <q-card flat class="mp-catalog-offer-card mp-card" :class="cardClasses" @click="onClick">
    <div class="mp-catalog-offer-card__media">
      <q-carousel
        v-if="images.length"
        v-model="slide"
        class="mp-catalog-offer-card__carousel"
        swipeable
        animated
        infinite
        transition-prev="slide-right"
        transition-next="slide-left"
        :arrows="images.length > 1"
        :navigation="false"
        control-color="primary"
        height="100%"
        @click.stop
      >
        <q-carousel-slide
          v-for="(img, i) in images"
          :key="img"
          :name="i"
          class="mp-catalog-offer-card__slide"
        >
          <!-- no-spinner: подписанный URL стабилизирован на бэкенде (окно
               getReadUrl), src не меняется при polling — лоудер только мигал бы.
               Клик по изображению = клик по карточке (стрелки карусели гасит
               @click.stop на самой ленте). -->
          <q-img :src="img" :alt="offer.title" fit="cover" no-spinner @click="onClick" />
        </q-carousel-slide>
      </q-carousel>
      <div v-else class="mp-catalog-offer-card__placeholder">
        <q-icon name="image" size="48px" color="grey-5" />
      </div>
      <span
        v-if="status"
        class="mp-status-chip mp-catalog-offer-card__status"
        :class="`mp-status-chip--${statusKind}`"
      >
        {{ statusLabel }}
      </span>
    </div>

    <q-card-section class="mp-catalog-offer-card__body">
      <div class="mp-catalog-offer-card__title">{{ offer.title }}</div>

      <div class="mp-catalog-offer-card__meta">
        <span class="mp-catalog-offer-card__price" v-if="offer.unitCost != null">
          {{ formatPrice(offer.unitCost) }}
          <span class="mp-catalog-offer-card__unit">/ {{ unitLabel }}</span>
        </span>
        <span class="mp-catalog-offer-card__stock" :class="{ 'mp-catalog-offer-card__stock--empty': isEmpty }">
          {{ stockLabel }}
        </span>
      </div>

      <div v-if="offer.description" class="mp-catalog-offer-card__desc">
        {{ offer.description }}
      </div>

      <!-- Доп. данные (категория, тип отсечки, гарантия, поставщик и т.п.) —
           заполняется родителем там, где нужно решать прямо в карточке
           (например модерация), чтобы не открывать отдельный диалог. -->
      <div v-if="$slots.details" class="mp-catalog-offer-card__details">
        <slot name="details" :offer="offer" />
      </div>
    </q-card-section>

    <q-card-actions v-if="$slots.actions" align="right" class="mp-catalog-offer-card__actions">
      <slot name="actions" :offer="offer" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'

export type CatalogOfferStatus = 'draft' | 'published' | 'paused' | 'sold-out' | 'completed' | 'moderation'

export interface CatalogOffer {
  id?: string | number
  title: string
  description?: string
  preview?: string         // URL одиночного изображения (legacy / обложка)
  images?: string[]        // URL'ы всех изображений — показываются каруселью
  remainUnits?: number
  unitCost?: number | string
  unitLabel?: string       // ед., шт., кг и т.д.
  status?: CatalogOfferStatus
}

const props = defineProps({
  offer: { type: Object as PropType<CatalogOffer>, required: true },
})

const emit = defineEmits<{
  (e: 'click', offer: CatalogOffer): void
}>()

// Источник картинок: массив images (если есть) или одиночный preview.
// Карусель листается свайпом/стрелками; точки-навигацию не показываем.
const images = computed<string[]>(() => {
  if (props.offer.images?.length) return props.offer.images
  return props.offer.preview ? [props.offer.preview] : []
})
const slide = ref(0)
const unitLabel = computed(() => props.offer.unitLabel ?? 'ед.')
const status = computed(() => props.offer.status)

type StatusKind = 'info' | 'success' | 'warning' | 'error' | 'neutral'

const STATUS_MAP: Record<CatalogOfferStatus, { label: string; kind: StatusKind }> = {
  draft:      { label: 'Черновик',      kind: 'neutral' },
  moderation: { label: 'На модерации',  kind: 'warning' },
  published:  { label: 'Опубликовано',  kind: 'success' },
  paused:     { label: 'Приостановлено', kind: 'warning' },
  'sold-out': { label: 'Закончилось',   kind: 'neutral' },
  completed:  { label: 'Завершено',     kind: 'neutral' },
}

const statusLabel = computed(() => (status.value ? STATUS_MAP[status.value].label : ''))
const statusKind  = computed<StatusKind>(() => (status.value ? STATUS_MAP[status.value].kind : 'neutral'))

const isEmpty = computed(() => (props.offer.remainUnits ?? 0) <= 0)
const stockLabel = computed(() => isEmpty.value
  ? 'Нет в наличии'
  : `${props.offer.remainUnits} ${unitLabel.value}`)

const cardClasses = computed(() => ({
  'mp-card--interactive': true,
  [`mp-catalog-offer-card--${status.value}`]: !!status.value,
}))

function formatPrice(v: number | string) {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function onClick() {
  emit('click', props.offer)
}
</script>

<style scoped lang="scss">
.mp-catalog-offer-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__media {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: var(--mp-surface-1);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform .4s ease;
    }
  }

  &__carousel {
    width: 100%;
    height: 100%;
    background: var(--mp-surface-1);

    // Слайд q-carousel по умолчанию имеет внутренний padding — обнуляем,
    // чтобы изображение шло во всю ширину карточки.
    :deep(.q-carousel__slide) {
      padding: 0;
    }

    .q-img {
      width: 100%;
      height: 100%;
    }
  }

  &:hover &__media img {
    transform: scale(1.02);
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__status {
    position: absolute;
    top: var(--mp-space-sm);
    left: var(--mp-space-sm);
    // Не хардкодим white — surface-0 переключается между light/dark автоматически.
    background: var(--mp-surface-0);
    backdrop-filter: blur(6px);
  }

  &__body {
    padding: var(--mp-space-md) var(--mp-space-md) var(--mp-space-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  &__title {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--mp-on-surface);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__meta {
    display: flex;
    align-items: baseline;
    gap: var(--mp-space-md);
    margin-top: 2px;
  }

  &__price {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -.01em;
    color: var(--mp-on-surface);
  }

  &__unit {
    font-size: 12px;
    font-weight: 400;
    color: var(--mp-on-surface-muted);
    margin-left: 2px;
  }

  &__stock {
    font-size: 12px;
    color: var(--mp-on-surface-muted);
    margin-left: auto;

    &--empty {
      color: var(--q-negative);
    }
  }

  &__desc {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    line-height: 1.45;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__details {
    margin-top: 4px;
  }

  &__actions {
    padding: 0 var(--mp-space-md) var(--mp-space-md);
    gap: var(--mp-space-sm);
  }
}

// На очень узких экранах — заголовок и цена уменьшаются деликатно
@media (max-width: 480px) {
  .mp-catalog-offer-card {
    &__title { font-size: 14px; }
    &__price { font-size: 16px; }
    &__media { aspect-ratio: 16 / 10; }
  }
}

// Per-role: на operator-POS — крупнее touch / шрифт
.mp-role-operator .mp-catalog-offer-card {
  &__title { font-size: 17px; }
  &__price { font-size: 20px; }
}
</style>
