<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <q-card v-if="offer" class="mp-offer-details mp-card" flat>
      <div class="mp-offer-details__media">
        <img v-if="offer.preview" :src="offer.preview" :alt="offer.title" />
        <div v-else class="mp-offer-details__placeholder">
          <q-icon name="fa-solid fa-image" size="56px" color="grey-5" />
        </div>
        <span
          v-if="offer.status"
          class="mp-status-chip mp-offer-details__status"
          :class="`mp-status-chip--${statusKind}`"
        >
          {{ statusLabel }}
        </span>
        <q-btn
          class="mp-offer-details__close"
          round
          dense
          flat
          icon="fa-solid fa-xmark"
          @click="emit('update:modelValue', false)"
          aria-label="Закрыть"
        />
      </div>

      <q-card-section class="mp-offer-details__body">
        <div class="mp-offer-details__title">{{ offer.title }}</div>

        <div class="mp-offer-details__price-row">
          <span v-if="offer.unitCost != null" class="mp-offer-details__price">
            {{ formatPrice(offer.unitCost) }}
            <span class="mp-offer-details__unit">/ {{ offer.unitLabel || 'ед.' }}</span>
          </span>
          <span class="mp-offer-details__stock" :class="{ 'mp-offer-details__stock--empty': isEmpty }">
            {{ stockLabel }}
          </span>
        </div>

        <q-list dense class="mp-offer-details__meta">
          <q-item v-if="offer.categoryName" class="mp-offer-details__meta-item">
            <q-item-section side>Категория</q-item-section>
            <q-item-section>{{ offer.categoryName }}</q-item-section>
          </q-item>
          <q-item v-if="offer.cycleType" class="mp-offer-details__meta-item">
            <q-item-section side>Тип отсечки</q-item-section>
            <q-item-section>{{ cycleLabel }}</q-item-section>
          </q-item>
          <q-item v-if="offer.warrantyDays != null && offer.warrantyDays > 0" class="mp-offer-details__meta-item">
            <q-item-section side>Гарантия</q-item-section>
            <q-item-section>{{ offer.warrantyDays }} дн.</q-item-section>
          </q-item>
          <q-item v-if="offer.supplierAccount" class="mp-offer-details__meta-item">
            <q-item-section side>Поставщик</q-item-section>
            <q-item-section>{{ offer.supplierAccount }}</q-item-section>
          </q-item>
        </q-list>

        <div v-if="offer.description" class="mp-offer-details__desc-block">
          <div class="mp-offer-details__desc-label">Описание</div>
          <div class="mp-offer-details__desc">{{ offer.description }}</div>
        </div>
        <div v-else class="mp-offer-details__desc-empty">Описание не заполнено.</div>

        <div v-if="offer.rejectReason" class="mp-offer-details__reject">
          <q-icon name="fa-solid fa-circle-exclamation" color="negative" size="16px" />
          <div>
            <div class="mp-offer-details__reject-label">Причина отклонения</div>
            <div>{{ offer.rejectReason }}</div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions v-if="$slots.actions" align="right" class="mp-offer-details__actions">
        <slot name="actions" :offer="offer" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { CatalogOfferStatus } from '../CatalogOfferCard'

/**
 * Story 3.x: детальный просмотр Offer'а в модальном окне.
 *
 * Карточки `CatalogOfferCard` в каталоге, на модерации и в «Мои предложения»
 * по клику открывают этот диалог: полное описание, мета (категория, тип
 * отсечки, гарантия), причина отклонения и slot `actions` под ролевые
 * кнопки (одобрить/отклонить — admin; редактировать/снять/запустить —
 * поставщик). Сам диалог не знает про роли — действия прокидывает родитель.
 */

export interface OfferDetail {
  id: string | number
  title: string
  description?: string | null
  preview?: string
  status?: CatalogOfferStatus
  unitCost?: number | string | null
  unitLabel?: string
  remainUnits?: number
  unlimited?: boolean
  categoryName?: string | null
  cycleType?: string | null
  warrantyDays?: number | null
  rejectReason?: string | null
  supplierAccount?: string | null
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  offer: { type: Object as PropType<OfferDetail | null>, default: null },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

type StatusKind = 'info' | 'success' | 'warning' | 'error' | 'neutral'

const STATUS_MAP: Record<CatalogOfferStatus, { label: string; kind: StatusKind }> = {
  draft:      { label: 'Черновик',       kind: 'neutral' },
  moderation: { label: 'На модерации',   kind: 'warning' },
  published:  { label: 'Опубликовано',   kind: 'success' },
  paused:     { label: 'Приостановлено', kind: 'warning' },
  'sold-out': { label: 'Закончилось',    kind: 'neutral' },
  completed:  { label: 'Завершено',      kind: 'neutral' },
}

const CYCLE_LABELS: Record<string, string> = {
  time_based: 'По расписанию',
  volume_based: 'По объёму',
  open_subscription: 'Открытая подписка',
  individual: 'Индивидуально',
}

const statusLabel = computed(() => (props.offer?.status ? STATUS_MAP[props.offer.status].label : ''))
const statusKind = computed<StatusKind>(() => (props.offer?.status ? STATUS_MAP[props.offer.status].kind : 'neutral'))
const cycleLabel = computed(() => (props.offer?.cycleType ? CYCLE_LABELS[props.offer.cycleType] ?? props.offer.cycleType : ''))

const isEmpty = computed(() => !props.offer?.unlimited && (props.offer?.remainUnits ?? 0) <= 0)
const stockLabel = computed(() => {
  if (props.offer?.unlimited) return 'Без ограничения'
  return isEmpty.value ? 'Нет в наличии' : `${props.offer?.remainUnits} ${props.offer?.unitLabel || 'ед.'}`
})

function formatPrice(v: number | string) {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' ₽'
}
</script>

<style scoped lang="scss">
.mp-offer-details {
  width: 560px;
  max-width: 92vw;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__media {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--mp-surface-1);
    overflow: hidden;

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
    background: var(--mp-surface-0);
    backdrop-filter: blur(6px);
  }

  &__close {
    position: absolute;
    top: var(--mp-space-sm);
    right: var(--mp-space-sm);
    background: var(--mp-surface-0);
  }

  &__body {
    padding: var(--mp-space-md) var(--mp-space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--mp-space-sm);
  }

  &__title {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--mp-on-surface);
  }

  &__price-row {
    display: flex;
    align-items: baseline;
    gap: var(--mp-space-md);
  }

  &__price {
    font-size: 20px;
    font-weight: 600;
    color: var(--mp-on-surface);
  }

  &__unit {
    font-size: 13px;
    font-weight: 400;
    color: var(--mp-on-surface-muted);
    margin-left: 2px;
  }

  &__stock {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    margin-left: auto;

    &--empty {
      color: var(--q-negative);
    }
  }

  &__meta {
    padding: 0;
  }

  &__meta-item {
    padding: 2px 0;
    min-height: 28px;

    .q-item__section--side {
      color: var(--mp-on-surface-muted);
      font-size: 13px;
      min-width: 120px;
    }
  }

  &__desc-block {
    margin-top: var(--mp-space-xs);
  }

  &__desc-label {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    margin-bottom: 4px;
  }

  &__desc {
    font-size: 14px;
    line-height: 1.5;
    color: var(--mp-on-surface);
    white-space: pre-wrap;
  }

  &__desc-empty {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    font-style: italic;
  }

  &__reject {
    display: flex;
    gap: var(--mp-space-sm);
    align-items: flex-start;
    padding: var(--mp-space-sm) var(--mp-space-md);
    border-radius: 8px;
    background: rgba(var(--q-negative-rgb, 193, 0, 21), 0.08);
    color: var(--mp-on-surface);
    font-size: 13px;
    line-height: 1.4;
  }

  &__reject-label {
    color: var(--q-negative);
    font-weight: 500;
    margin-bottom: 2px;
  }

  &__actions {
    padding: var(--mp-space-sm) var(--mp-space-lg) var(--mp-space-md);
    gap: var(--mp-space-sm);
  }
}
</style>
