<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import {
  fetchCatalog,
  fetchCategories,
  fetchCategoryOfferCounts,
} from '../api';
import type {
  CatalogSort,
  MarketplaceCategoryOfferCount,
  MarketplaceCategoryView,
  MarketplaceOfferView,
} from '../types';

/**
 * Story 3.5: каталог Стола заказов на orderer-столе.
 *
 * Канон UI — `widgets/Marketplace/CatalogOfferCard` (Эпик 10, UX-DR10).
 * Корневой класс `mp-role-orderer` подтягивает токены плотности и touch-target
 * из `marketplace-tokens.scss`; статусы — через `.mp-status-chip` внутри
 * виджета; per-offer actions — через slot `actions`.
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

const UNIT_LABEL: Record<MarketplaceOfferView['unit_of_measure'], string> = {
  piece: 'шт',
  kg: 'кг',
  liter: 'л',
  pack: 'упак',
};

function toCatalogOffer(offer: MarketplaceOfferView): CatalogOffer {
  const isEmpty = !offer.unlimited_flag && offer.quantity_available <= 0;
  const status: CatalogOfferStatus = isEmpty ? 'sold-out' : 'published';
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    remainUnits: offer.unlimited_flag ? undefined : offer.quantity_available,
    unitCost: offer.price_per_unit,
    unitLabel: UNIT_LABEL[offer.unit_of_measure],
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
  for (const c of cc as MarketplaceCategoryOfferCount[]) map.set(c.category_id, c.count);
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

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  currentPage.value += 1;
  await loadPage(true);
}

function onSelectOffer(offer: MarketplaceOfferView): void {
  // Story 4.1 Order-форма; пока — заглушка
  Notify.create({
    type: 'info',
    message: `Создание заказа на Offer ${offer.id} — будет доступно после Эпика 4`,
  });
}

onMounted(async () => {
  await loadCategories();
  await loadPage(false);
});
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-catalog-page(role="region", aria-label="Каталог Стола заказов")
  div.mp-catalog-page__header
    div.text-h5 Каталог
    q-space
    q-select(
      v-model="sort",
      :options="sortOptions",
      option-value="value",
      option-label="label",
      emit-value,
      map-options,
      dense,
      outlined,
      style="min-width: 180px",
      label="Сортировка",
      @update:model-value="changeSort(sort)"
    )

  div.mp-catalog-page__filters(role="tablist", aria-label="Фильтр по категориям")
    q-chip.mp-filter-chip(
      :selected="selectedCategoryId === ALL_KEY",
      clickable,
      outline,
      selected-color="primary",
      :aria-selected="selectedCategoryId === ALL_KEY",
      @click="selectCategory(ALL_KEY)"
    )
      span Все
      span.mp-filter-chip__count {{ totalActiveCount }}
    q-chip.mp-filter-chip(
      v-for="cat in categories",
      :key="cat.id",
      :selected="selectedCategoryId === cat.id",
      clickable,
      outline,
      selected-color="primary",
      :aria-selected="selectedCategoryId === cat.id",
      @click="selectCategory(cat.id)"
    )
      span {{ cat.display_name }}
      span.mp-filter-chip__count {{ counts.get(cat.id) ?? 0 }}

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-catalog-page__empty(v-if="!loading && items.length === 0")
    q-icon(name="fa-regular fa-circle-question", size="3em")
    div.text-subtitle1 Ничего не найдено
    div.text-caption
      template(v-if="selectedCategoryId !== ALL_KEY") Попробуйте сменить категорию
      template(v-else) В каталоге пока нет активных предложений

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    div.row.q-col-gutter-md
      div.col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="toCatalogOffer(o)", @click="onSelectOffer(o)")
          template(v-slot:actions)
            q-btn(
              unelevated,
              dense,
              no-caps,
              color="primary",
              label="Заказать",
              :disable="!canOrder(o)",
              @click.stop="onSelectOffer(o)"
            )
    template(v-slot:loading)
      div.row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")
</template>

<style scoped lang="scss">
.mp-catalog-page {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: center;
    gap: var(--mp-space-md);
  }

  &__filters {
    display: flex;
    gap: var(--mp-space-sm);
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: var(--mp-space-xs);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--mp-space-xs);
    padding: var(--mp-space-xxl) var(--mp-space-md);
    color: var(--mp-on-surface-muted);
  }
}

.mp-filter-chip {
  &__count {
    margin-left: var(--mp-space-xs);
    color: var(--mp-on-surface-muted);
    font-size: 12px;
  }

  &.q-chip--selected .mp-filter-chip__count {
    color: inherit;
    opacity: .85;
  }
}
</style>
