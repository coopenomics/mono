<script lang="ts" setup>
import { computed } from 'vue';
import { t, uiLocale } from 'src/shared/i18n';

/**
 * Сводная оценка одной строкой: звёзды, средняя и число отзывов.
 * Без отзывов строка пуста либо показывает `emptyText` — ноль отзывов числом
 * не пишется.
 */
const props = withDefaults(
  defineProps<{
    /** Средняя оценка; null — отзывов нет. */
    rating?: number | null;
    /** Число отзывов. */
    count?: number | null;
    /** Короткая запись для карточки каталога: «4,8 (12)». */
    compact?: boolean;
    /** Что показать, когда отзывов нет; не задано — ничего. */
    emptyText?: string;
  }>(),
  { rating: null, count: 0, compact: false, emptyText: '' },
);

const reviewsCount = computed(() => props.count ?? 0);
const hasReviews = computed(() => reviewsCount.value > 0 && props.rating != null);

/** Звёзды рисуются с шагом в половину: 4,8 — это пять, 4,3 — четыре с половиной. */
const starsValue = computed(() => Math.round((props.rating ?? 0) * 2) / 2);

const ratingLabel = computed(() =>
  (props.rating ?? 0).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);

const countLabel = computed(() =>
  props.compact
    ? `(${reviewsCount.value})`
    : t('marketplace.reviewStars.count', { n: reviewsCount.value }, reviewsCount.value),
);
</script>

<template lang="pug">
.review-stars(v-if="hasReviews", :class="{ 'review-stars--compact': compact }")
  q-rating(
    :model-value="starsValue",
    readonly,
    :max="5",
    :size="compact ? '14px' : '16px'",
    color="accent",
    icon="star_border",
    icon-selected="star",
    icon-half="star_half"
  )
  span.review-stars__rating {{ ratingLabel }}
  span.review-stars__count(v-if="compact") {{ countLabel }}
  template(v-else)
    span.review-stars__dot(aria-hidden="true") ·
    span.review-stars__count {{ countLabel }}
.review-stars.review-stars--empty(v-else-if="emptyText") {{ emptyText }}
</template>

<style scoped lang="scss">
.review-stars {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);

  &__rating {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__count,
  &__dot {
    color: var(--p-ink-3);
  }

  &--compact {
    font-size: var(--p-fs-meta);
  }

  &--empty {
    color: var(--p-ink-3);
  }
}
</style>
