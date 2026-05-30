<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Notify } from 'quasar';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { BaseSelect, BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import {
  fetchCatalog,
  fetchCategories,
  fetchCategoryOfferCounts,
} from '../api';
import type {
  CatalogSort,
  MarketplaceCategoryView,
  MarketplaceOfferView,
} from '../types';
import OrderCreateDialog from './OrderCreateDialog.vue';

/**
 * Story 3.5: каталог Стола заказов на orderer-столе.
 *
 * Канон UI — `widgets/Marketplace/CatalogOfferCard` (карточка предложения).
 * Страница свёрстана по MONO Platform v2: канон-токены `--p-*`, фильтр
 * категорий — тоггл-чипы `.chip`, действие «Заказать» — `BaseButton`.
 */

const ALL_KEY = -1 as number;
const PAGE_SIZE = 24;

const categories = ref<MarketplaceCategoryView[]>([]);
const counts = ref<Map<number, number>>(new Map());
const items = ref<MarketplaceOfferView[]>([]);
const total = ref(0);
const loading = ref(false);
const selectedCategoryId = ref<number>(ALL_KEY);
const sort = ref<CatalogSort>('created_at_desc');
const currentPage = ref(1);

const hasMore = computed(() => items.value.length < total.value);

const totalActiveCount = computed(() =>
  Array.from(counts.value.values()).reduce((acc, v) => acc + v, 0)
);

const sortOptions: Array<{ label: string; value: CatalogSort }> = [
  { label: 'Свежие сначала', value: 'created_at_desc' },
  { label: 'Цена ↑', value: 'price_asc' },
  { label: 'Цена ↓', value: 'price_desc' },
];

const emptyBody = computed(() =>
  selectedCategoryId.value !== ALL_KEY
    ? 'Попробуйте сменить категорию.'
    : 'В каталоге пока нет активных предложений.'
);

function toCatalogOffer(offer: MarketplaceOfferView): CatalogOffer {
  const isEmpty = !offer.unlimited_flag && offer.quantity_available <= 0;
  const status: CatalogOfferStatus = isEmpty ? 'sold-out' : 'published';
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    images: marketplaceOfferImageUrls(offer.images),
    remainUnits: offer.unlimited_flag ? undefined : offer.quantity_available,
    unitCost: offer.price_per_unit,
    unitLabel: marketplaceUnitShort(offer.unit_of_measure),
    status,
  };
}

function canOrder(offer: MarketplaceOfferView): boolean {
  return offer.unlimited_flag || offer.quantity_available > 0;
}

async function loadCategories(): Promise<void> {
  const [cats, cc] = await Promise.all([fetchCategories(), fetchCategoryOfferCounts()]);
  categories.value = cats;
  const map = new Map<number, number>();
  for (const c of cc) map.set(c.category_id, c.count);
  counts.value = map;
}

async function loadPage(append: boolean): Promise<void> {
  loading.value = true;
  try {
    const page = await fetchCatalog({
      category_id: selectedCategoryId.value === ALL_KEY ? null : selectedCategoryId.value,
      page: currentPage.value,
      limit: PAGE_SIZE,
      sort: sort.value,
    });
    total.value = page.totalCount;
    items.value = append ? items.value.concat(page.items) : page.items;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function selectCategory(id: number): void {
  selectedCategoryId.value = id;
  currentPage.value = 1;
  void loadPage(false);
}

function changeSort(newSort: CatalogSort): void {
  sort.value = newSort;
  currentPage.value = 1;
  void loadPage(false);
}

function isCatalogSort(value: string | number | null): value is CatalogSort {
  return sortOptions.some((option) => option.value === value);
}

function onSortChange(value: string | number | null): void {
  if (isCatalogSort(value)) changeSort(value);
}

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  currentPage.value += 1;
  await loadPage(true);
}

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
const orderDialogOpen = ref(false);
const orderDialogOffer = ref<MarketplaceOfferView | null>(null);

function onSelectOffer(offer: MarketplaceOfferView): void {
  if (!canOrder(offer)) return;
  orderDialogOffer.value = offer;
  orderDialogOpen.value = true;
}

async function onOrderCreated(): Promise<void> {
  await loadPage(false);
}

onMounted(async () => {
  await loadCategories();
  await loadPage(false);
});
</script>

<template lang="pug">
q-page.catalog(role="region", aria-label="Каталог Стола заказов")
  PageHint(storage-key="mp:catalog:banner-dismissed")
    | Предложения поставщиков кооператива. Выберите товар или оформите заказ на ваш пункт выдачи.

  .catalog__toolbar
    .catalog__filters(role="tablist", aria-label="Фильтр по категориям")
      .chip.catalog__chip(
        :class="selectedCategoryId === ALL_KEY ? 'chip--accent' : 'chip--neutral'",
        role="tab",
        :aria-selected="selectedCategoryId === ALL_KEY",
        tabindex="0",
        @click="selectCategory(ALL_KEY)",
        @keydown.enter="selectCategory(ALL_KEY)"
      )
        span Все
        span.catalog__count {{ totalActiveCount }}
      .chip.catalog__chip(
        v-for="cat in categories",
        :key="cat.id",
        :class="selectedCategoryId === cat.id ? 'chip--accent' : 'chip--neutral'",
        role="tab",
        :aria-selected="selectedCategoryId === cat.id",
        tabindex="0",
        @click="selectCategory(cat.id)",
        @keydown.enter="selectCategory(cat.id)"
      )
        span {{ cat.display_name }}
        span.catalog__count {{ counts.get(cat.id) ?? 0 }}
    q-space
    BaseSelect.catalog__sort(
      :model-value="sort",
      :options="sortOptions",
      label="Сортировка",
      @update:model-value="onSortChange"
    )

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!loading && items.length === 0",
    title="Ничего не найдено",
    :body="emptyBody"
  )
    template(#icon)
      q-icon(name="search_off", size="48px")

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="toCatalogOffer(o)", @click="onSelectOffer(o)")
          template(#actions)
            BaseButton(
              variant="primary",
              size="sm",
              :disabled="!canOrder(o)",
              @click.stop="onSelectOffer(o)"
            ) Заказать
    template(#loading)
      .row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")

  OrderCreateDialog(
    v-model="orderDialogOpen",
    :coopname="coopname",
    :offer="orderDialogOffer",
    @created="onOrderCreated"
  )
</template>

<style scoped lang="scss">
.catalog {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__filters {
    display: flex;
    gap: var(--p-2, 8px);
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: var(--p-1, 4px);
    flex: 1 1 auto;
    min-width: 0;
  }

  &__chip {
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  &__count {
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__sort {
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .catalog {
    padding: var(--p-4, 16px);
  }
}
</style>
