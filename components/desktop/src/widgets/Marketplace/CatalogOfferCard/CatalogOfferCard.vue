<template>
  <q-card flat class="mp-catalog-offer-card mp-card" :class="cardClasses" @click="onClick">
    <div class="mp-catalog-offer-card__media">
      <!-- Канон-виджет галереи (общая карусель: каталог / деталь оферты /
           деталь заказа). Клик по изображению открывает карточку; стрелки
           карусели гасит @click.stop внутри виджета. Точки-навигацию в каталоге
           не показываем. -->
      <OfferGallery
        :images="images"
        :alt="offer.title"
        :navigation="false"
        height="100%"
        @image-click="onClick"
      />
      <span
        v-if="status"
        class="mp-status-chip mp-catalog-offer-card__status"
        :class="`mp-status-chip--${statusKind}`"
      >
        {{ statusLabel }}
      </span>
    </div>

    <q-card-section class="mp-catalog-offer-card__body">
      <div v-if="offer.category" class="mp-catalog-offer-card__category">{{ offer.category }}</div>

      <div class="mp-catalog-offer-card__title">{{ offer.title }}</div>

      <div v-if="offer.coopStock" class="mp-catalog-offer-card__supplier">
        <q-icon name="warehouse" size="13px" />
        <span>Со склада кооператива — выдача сразу</span>
      </div>
      <div v-else-if="offer.supplierName" class="mp-catalog-offer-card__supplier">
        <q-icon name="storefront" size="13px" />
        <span>{{ offer.supplierName }}</span>
      </div>

      <div class="mp-catalog-offer-card__meta">
        <span class="mp-catalog-offer-card__price" v-if="offer.unitCost != null">
          {{ formatPrice(unitCostWithFee) }}
          <span class="mp-catalog-offer-card__unit">/ {{ unitLabel }}</span>
        </span>
        <span class="mp-catalog-offer-card__stock" :class="{ 'mp-catalog-offer-card__stock--empty': isEmpty }">
          {{ stockLabel }}
        </span>
      </div>

      <div v-if="hasFee && showFeeNote" class="mp-catalog-offer-card__fee-note">
        Цена с членским взносом {{ feeLabel }}
      </div>

      <div v-if="shortDescription" class="mp-catalog-offer-card__desc">
        {{ shortDescription }}
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
import { computed, type PropType } from 'vue'
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery'
import { applyMembershipFee } from 'src/shared/lib/marketplace'

export type CatalogOfferStatus = 'draft' | 'published' | 'paused' | 'sold-out' | 'completed' | 'moderation' | 'withdrawn'

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
  category?: string        // название категории — показывается над заголовком
  supplierName?: string    // ФИО / наименование поставщика
  coopStock?: boolean      // предложение кооператива со склада КУ — мгновенная выдача
}

const props = defineProps({
  offer: { type: Object as PropType<CatalogOffer>, required: true },
  // Кликабельна ли карточка (курсор-pointer + hover-zoom + emit click).
  // На экранах, где по карточке ничего не открывается (модерация — решение
  // принимается прямо в ней), передаём false.
  clickable: { type: Boolean, default: true },
  // Единая ставка членского взноса кооператива, проценты (requirement b6).
  // Если задана и > 0 — карточка ВСЕГДА показывает цену с учётом взноса (он
  // входит в стоимость, которую заказчик реально платит).
  feePercent: { type: Number, default: 0 },
  // Поясняющая подпись «Цена с членским взносом N%» — только для
  // поставщика/администратора (им нужно видеть разбивку). Заказчику она не
  // нужна: он видит просто финальную цену, без экономики кооператива.
  showFeeNote: { type: Boolean, default: true },
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
  withdrawn:  { label: 'Снято с публикации', kind: 'neutral' },
}

const statusLabel = computed(() => (status.value ? STATUS_MAP[status.value].label : ''))
const statusKind  = computed<StatusKind>(() => (status.value ? STATUS_MAP[status.value].kind : 'neutral'))

// В карточке — только краткая выжимка (полное описание открывается на странице
// предложения по клику). Жёсткая отсечка по символам страхует от длинных
// текстов вне зависимости от line-clamp.
const DESC_MAX = 200
const shortDescription = computed(() => {
  const d = props.offer.description?.trim()
  if (!d) return ''
  return d.length > DESC_MAX ? `${d.slice(0, DESC_MAX).trimEnd()}…` : d
})

// remainUnits === undefined/null означает «без ограничений по количеству»
// (родительский маппинг: unlimited_flag ? undefined : quantity_available).
// Безлимит ≠ отсутствие товара — «сколько угодно» это доступность, а не пусто,
// поэтому красную метку «Нет в наличии» в этом случае не ставим (как на странице
// детали оферты, где безлимит = «Без ограничения остатка»).
const isUnlimited = computed(() => props.offer.remainUnits == null)
const isEmpty = computed(() => !isUnlimited.value && (props.offer.remainUnits ?? 0) <= 0)
const stockLabel = computed(() => {
  if (isUnlimited.value) return 'Без ограничений'
  return isEmpty.value
    ? 'Нет в наличии'
    : `${props.offer.remainUnits} ${unitLabel.value}`
})

const cardClasses = computed(() => ({
  'mp-card--interactive': props.clickable,
  [`mp-catalog-offer-card--${status.value}`]: !!status.value,
}))

const hasFee = computed(() => (props.feePercent ?? 0) > 0 && props.offer.unitCost != null)

const unitCostWithFee = computed<number | string>(() => {
  const base = props.offer.unitCost
  if (base == null) return ''
  if (!hasFee.value) return base
  const n = typeof base === 'number' ? base : Number(base)
  if (Number.isNaN(n)) return base
  return applyMembershipFee(n, props.feePercent)
})

const feeLabel = computed(() => {
  const p = props.feePercent
  return (Number.isInteger(p) ? String(p) : p.toFixed(2).replace(/\.?0+$/, '')) + ' %'
})

function formatPrice(v: number | string) {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' ₽'
}

function onClick() {
  if (!props.clickable) return
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

    // img живёт внутри дочернего OfferGallery — достаём через :deep.
    :deep(img) {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform .4s ease;
    }
  }

  &.mp-card--interactive:hover &__media :deep(img) {
    transform: scale(1.02);
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

  &__category {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: .03em;
    text-transform: uppercase;
    color: var(--mp-on-surface-muted);
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

  &__supplier {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--mp-on-surface-muted);

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__meta {
    display: flex;
    align-items: baseline;
    gap: var(--mp-space-md);
    margin-top: 2px;
  }

  &__fee-note {
    font-size: 12px;
    color: var(--p-ink-3);
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
