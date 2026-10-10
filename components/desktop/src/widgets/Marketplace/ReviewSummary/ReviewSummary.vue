<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { t, uiLocale } from 'src/shared/i18n';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { loadReviewSummary, type MarketplaceReviewSummaryView } from 'src/entities/MarketplaceReview';
import { ReviewList } from '../ReviewList';

/**
 * Сводка отзывов о поставщике: средняя оценка, распределение по звёздам и
 * сами отзывы по всем его предложениям — у каждого названо предложение.
 */
const props = withDefaults(
  defineProps<{
    supplierAccount: string;
    /** Маршрут страницы предложения на том столе, где стоит сводка. */
    offerRouteName?: string;
  }>(),
  { offerRouteName: 'marketplace-offer-detail' },
);

const summary = ref<MarketplaceReviewSummaryView | null>(null);

const reviewsCount = computed(() => summary.value?.reviews_count ?? 0);
const ratingLabel = computed(() =>
  (summary.value?.rating_avg ?? 0).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);
const countLabel = computed(() =>
  t('marketplace.reviewStars.count', { n: reviewsCount.value }, reviewsCount.value),
);
const starsValue = computed(() => Math.round((summary.value?.rating_avg ?? 0) * 2) / 2);

/** Строки распределения: доля отзывов с каждой оценкой. */
const breakdown = computed(() =>
  (summary.value?.stars_breakdown ?? []).map((row) => ({
    stars: row.stars,
    count: row.count,
    share: reviewsCount.value > 0 ? row.count / reviewsCount.value : 0,
  })),
);

async function load(): Promise<void> {
  try {
    summary.value = await loadReviewSummary({ supplier_account: props.supplierAccount });
  } catch {
    // Сводка — дополнение к списку: без неё отзывы всё равно видны ниже.
  }
}

watch(() => props.supplierAccount, () => void load(), { immediate: true });

const reloadLive = debounce(() => void load(), 400);
useLiveReload(marketLiveTables('review'), () => reloadLive());
</script>

<template lang="pug">
.review-summary
  .review-summary__top(v-if="reviewsCount > 0")
    .review-summary__score
      .review-summary__rating {{ ratingLabel }}
      q-rating(
        :model-value="starsValue",
        readonly,
        :max="5",
        size="18px",
        color="accent",
        icon="star_border",
        icon-selected="star",
        icon-half="star_half"
      )
      .review-summary__count {{ countLabel }}
    .review-summary__breakdown
      .review-summary__row(v-for="row in breakdown", :key="row.stars")
        span.review-summary__row-label {{ row.stars }}
        q-icon(name="star", size="14px")
        q-linear-progress.review-summary__bar(:value="row.share", rounded, size="6px", color="primary", track-color="grey-3")
        span.review-summary__row-count {{ row.count }}
  ReviewList(:supplier-account="supplierAccount", :offer-route-name="offerRouteName", show-offer)
</template>

<style scoped lang="scss">
.review-summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  // Зоны сводки: итоговая оценка слева, распределение справа.
  &__top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--p-6);
    align-items: center;
    padding-bottom: var(--p-4);
    border-bottom: 1px solid var(--p-line);
  }

  &__score {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-1);
  }

  &__rating {
    font-size: var(--p-fs-h1);
    font-weight: 700;
    line-height: 1;
    color: var(--p-ink);
  }

  &__count {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    max-width: 360px;
  }

  &__row {
    display: grid;
    grid-template-columns: 1ch auto minmax(0, 1fr) 3ch;
    align-items: center;
    gap: var(--p-2);
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__row-count {
    text-align: right;
    color: var(--p-ink-3);
  }
}

@media (max-width: 600px) {
  .review-summary__top {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
