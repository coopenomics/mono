<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Notify } from 'quasar';
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
import CatalogOfferCard from './CatalogOfferCard.vue';

/**
 * Story 3.5: каталог Стола заказов на orderer-столе.
 *
 * AC:
 *  - grid карточек (UX-DR10) с пагинацией 24/страницу (infinite-load
 *    через `q-infinite-scroll`);
 *  - фильтр-чипы по 10 baseline-категориям с counter'ами (single-select
 *    в MVP, «Все» — снимает фильтр);
 *  - сортировки created_at_desc (default) / price_asc / price_desc;
 *  - responsive: mobile 1 колонка, desktop 3-4 (UX-DR22, DR31);
 *  - EmptyState при пустом каталоге / пустом фильтре;
 *  - PENDING_MODERATION / REJECTED / WITHDRAWN не показываются (backend
 *    фильтрует status=ACTIVE + (unlimited OR available>0)).
 *
 * Order-форма (Эпик 4 Story 4.1) пока stub: alert(); подменится на
 * `router.push({name:'marketplace-create-order', params:{offer_id}})`.
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
const offset = ref(0);

const hasMore = computed(() => items.value.length < total.value);

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
      limit: PAGE_SIZE,
      offset: offset.value,
      sort: sort.value,
    });
    total.value = page.total;
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
  offset.value = 0;
  void loadPage(false);
}

function changeSort(newSort: CatalogSort): void {
  sort.value = newSort;
  offset.value = 0;
  void loadPage(false);
}

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  offset.value = items.value.length;
  await loadPage(true);
}

function onSelectOffer(offer: MarketplaceOfferView): void {
  // Story 4.1 Order-форма; пока — заглушка
  Notify.create({
    type: 'info',
    message: `Создание заказа на Offer ${offer.id} — будет доступно после Эпика 4`,
  });
}

const totalActiveCount = computed(() =>
  Array.from(counts.value.values()).reduce((acc, v) => acc + v, 0)
);

const sortOptions: Array<{ label: string; value: CatalogSort }> = [
  { label: 'Свежие сначала', value: 'created_at_desc' },
  { label: 'Цена ↑', value: 'price_asc' },
  { label: 'Цена ↓', value: 'price_desc' },
];

watch(
  () => sort.value,
  () => void 0
);

onMounted(async () => {
  await loadCategories();
  await loadPage(false);
});
</script>

<template lang="pug">
q-page.q-pa-md(role="region", aria-label="Каталог Стола заказов")
  div.row.items-center.q-mb-md
    div.text-h5 Каталог
    q-space
    q-select.col-auto(
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

  div.row.q-gutter-sm.q-mb-md.scroll-x(role="tablist", aria-label="Фильтр по категориям")
    q-chip(
      :selected="selectedCategoryId === ALL_KEY",
      clickable,
      color="grey-3",
      text-color="dark",
      :selected-color="'primary'",
      :aria-selected="selectedCategoryId === ALL_KEY",
      @click="selectCategory(ALL_KEY)"
    )
      span Все
      q-badge.q-ml-xs(color="grey-7") {{ totalActiveCount }}
    q-chip(
      v-for="cat in categories",
      :key="cat.id",
      :selected="selectedCategoryId === cat.id",
      clickable,
      color="grey-3",
      text-color="dark",
      :selected-color="'primary'",
      :aria-selected="selectedCategoryId === cat.id",
      @click="selectCategory(cat.id)"
    )
      span {{ cat.display_name }}
      q-badge.q-ml-xs(color="grey-7") {{ counts.get(cat.id) ?? 0 }}

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div(v-if="!loading && items.length === 0").text-center.q-pa-xl.text-grey-7
    q-icon(name="fa-regular fa-circle-question", size="3em").q-mb-sm
    div.text-subtitle1 Ничего не найдено
    div.text-caption
      template(v-if="selectedCategoryId !== ALL_KEY") Попробуйте сменить категорию
      template(v-else) В каталоге пока нет активных оферт

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    div.row.q-col-gutter-md
      div.col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="o", @select="onSelectOffer")
    template(v-slot:loading)
      div.row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")
</template>

<style scoped>
.scroll-x {
  overflow-x: auto;
  flex-wrap: nowrap;
}
</style>
