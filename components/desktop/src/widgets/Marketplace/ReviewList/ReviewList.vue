<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { useFirstLoad } from 'src/shared/lib/composables';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import { Avatar, BaseButton, EmptyState } from 'src/shared/ui/base';
import { listReviews, type MarketplaceReviewView } from 'src/entities/MarketplaceReview';

/**
 * Опубликованные отзывы об одном предложении либо обо всех предложениях
 * поставщика. В списке поставщика у каждого отзыва названо предложение —
 * ссылкой на его страницу.
 */
const PAGE_SIZE = 10;

const props = withDefaults(
  defineProps<{
    /** Отзывы об одном предложении. */
    offerId?: string | null;
    /** Отзывы обо всех предложениях поставщика. */
    supplierAccount?: string | null;
    /** Назвать у отзыва предложение (в списке поставщика). */
    showOffer?: boolean;
    /** Действие «Скрыть» у каждого отзыва — для администратора. */
    moderation?: boolean;
    /** Маршрут страницы предложения на том столе, где стоит список. */
    offerRouteName?: string;
  }>(),
  {
    offerId: null,
    supplierAccount: null,
    showOffer: false,
    moderation: false,
    offerRouteName: 'marketplace-offer-detail',
  },
);

const emit = defineEmits<{
  (e: 'hide', review: MarketplaceReviewView): void;
}>();

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));

const items = ref<MarketplaceReviewView[]>([]);
const total = ref(0);
const shown = ref(PAGE_SIZE);
const loading = ref(true);
const loadingMore = ref(false);
const firstLoad = useFirstLoad(loading);

const hasMore = computed(() => items.value.length < total.value);
const hasTarget = computed(() => Boolean(props.offerId || props.supplierAccount));

/** Список перечитывается целиком на показанную глубину: порядок и состав свежие. */
async function load(): Promise<void> {
  if (!hasTarget.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const page = await listReviews(
      { offer_id: props.offerId ?? null, supplier_account: props.supplierAccount ?? null },
      { page: 1, limit: shown.value, sortBy: 'created_at', sortOrder: 'DESC' },
    );
    items.value = page.items;
    total.value = page.totalCount;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function showMore(): Promise<void> {
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  shown.value += PAGE_SIZE;
  await load();
  loadingMore.value = false;
}

function formatDate(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY');
}

function authorName(review: MarketplaceReviewView): string {
  return review.author_name || t('marketplace.reviewList.authorFallback');
}

watch(
  () => [props.offerId, props.supplierAccount],
  () => {
    shown.value = PAGE_SIZE;
    void load();
  },
  { immediate: true },
);

const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useLiveReload(marketLiveTables('review'), () => reloadLive());

defineExpose({ reload: load });
</script>

<template lang="pug">
.review-list
  .review-list__skeleton(v-if="firstLoad")
    q-skeleton(v-for="n in 3", :key="n", type="rect", height="72px")

  EmptyState(
    v-else-if="items.length === 0",
    :title="$t('marketplace.reviewList.emptyTitle')",
    :body="$t('marketplace.reviewList.emptyBody')"
  )
    template(#icon)
      q-icon(name="rate_review", size="40px")

  template(v-else)
    article.review-list__item(v-for="review in items", :key="review.id")
      Avatar(:name="authorName(review)", size="md")
      .review-list__content
        .review-list__head
          span.review-list__author {{ authorName(review) }}
          span.review-list__date {{ formatDate(review.created_at) }}
        q-rating(
          :model-value="review.stars",
          readonly,
          :max="5",
          size="16px",
          color="accent",
          icon="star_border",
          icon-selected="star"
        )
        router-link.review-list__offer(
          v-if="showOffer && review.offer_name",
          :to="{ name: offerRouteName, params: { coopname, offerId: review.offer_id } }"
        ) {{ review.offer_name }}
        .review-list__text(v-if="review.text") {{ review.text }}
      .review-list__actions(v-if="moderation")
        BaseButton(variant="secondary", size="sm", @click="emit('hide', review)") {{ $t('marketplace.reviewList.hideAction') }}

    .review-list__more(v-if="hasMore")
      BaseButton(variant="secondary", size="sm", :loading="loadingMore", @click="showMore") {{ $t('marketplace.reviewList.showMoreAction') }}
</template>

<style scoped lang="scss">
.review-list {
  display: flex;
  flex-direction: column;

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--p-3);
  }

  // Зоны отзыва: кто и когда → оценка → о чём → текст; действие прижато вправо.
  &__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--p-3);
    padding: var(--p-4) 0;
    border-bottom: 1px solid var(--p-line);

    &:last-of-type {
      border-bottom: none;
    }
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: baseline;
    gap: var(--p-2);
    flex-wrap: wrap;
  }

  &__author {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__date {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__offer {
    font-size: var(--p-fs-body-sm);
    color: var(--p-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &__text {
    color: var(--p-ink-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__more {
    display: flex;
    justify-content: center;
    padding-top: var(--p-3);
  }
}
</style>
