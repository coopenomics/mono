<template>
  <q-card flat bordered class="mp-catalog-offer-card" :class="cardClasses" @click="onClick">
    <div class="mp-catalog-offer-card__media">
      <img v-if="src" :src="src" :alt="offer.title" />
      <div v-else class="mp-catalog-offer-card__placeholder">
        <q-icon name="fa-solid fa-image" size="48px" color="grey-5" />
      </div>
      <q-badge v-if="status" :color="statusColor" class="mp-catalog-offer-card__status mp-status-badge">
        {{ statusLabel }}
      </q-badge>
    </div>

    <q-card-section>
      <div class="text-h6 mp-catalog-offer-card__title">{{ offer.title }}</div>

      <div class="row q-gutter-sm q-mt-sm items-center">
        <q-badge outline color="primary">
          {{ offer.remainUnits ?? 0 }} {{ unitLabel }}
        </q-badge>
        <q-badge outline color="accent" v-if="offer.unitCost != null">
          {{ formatPrice(offer.unitCost) }}
        </q-badge>
      </div>

      <div v-if="offer.description" class="text-body2 q-mt-sm text-grey-7 mp-catalog-offer-card__desc">
        {{ offer.description }}
      </div>
    </q-card-section>

    <q-card-actions v-if="$slots.actions" align="right">
      <slot name="actions" :offer="offer" />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

export type CatalogOfferStatus = 'draft' | 'published' | 'paused' | 'sold-out' | 'completed' | 'moderation'

export interface CatalogOffer {
  id?: string | number
  title: string
  description?: string
  preview?: string         // URL изображения (если есть)
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

const src = computed(() => props.offer.preview || '')
const unitLabel = computed(() => props.offer.unitLabel ?? 'ед.')
const status = computed(() => props.offer.status)

const STATUS_MAP: Record<CatalogOfferStatus, { label: string; color: string }> = {
  draft:      { label: 'Черновик',      color: 'grey'     },
  moderation: { label: 'На модерации',  color: 'warning'  },
  published:  { label: 'Опубликовано',  color: 'positive' },
  paused:     { label: 'Приостановлено', color: 'orange'   },
  'sold-out': { label: 'Распродано',    color: 'negative' },
  completed:  { label: 'Завершено',     color: 'info'     },
}

const statusLabel = computed(() => (status.value ? STATUS_MAP[status.value].label : ''))
const statusColor = computed(() => (status.value ? STATUS_MAP[status.value].color : 'grey'))

const cardClasses = computed(() => ({
  'mp-catalog-offer-card--clickable': true,
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
  border-radius: 8px;
  overflow: hidden;
  transition: transform .2s ease, box-shadow .2s ease;

  &--clickable {
    cursor: pointer;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, .12);
    }
  }

  &__media {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: rgba(0, 0, 0, .04);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
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
  }

  &__title {
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__desc {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

// Per-role: на operator-POS (POS-режим) больше touch — большие отступы
.mp-role-operator .mp-catalog-offer-card {
  &__title { font-size: 1.25rem; }
}
</style>
