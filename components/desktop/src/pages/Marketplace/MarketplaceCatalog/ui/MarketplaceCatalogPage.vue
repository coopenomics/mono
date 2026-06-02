<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { BaseSelect, BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
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

// Категории как канон-вкладки (`PageTabs` со счётчиком). `key` — строковый id
// категории (или 'all'), счётчик — число активных предложений в категории.
const categoryTabs = computed<PageTab[]>(() => [
  { key: 'all', label: 'Все', count: totalActiveCount.value },
  ...categories.value.map((cat) => ({
    key: String(cat.id),
    label: cat.display_name,
    count: counts.value.get(cat.id) ?? 0,
  })),
]);

const activeCategoryKey = computed(() =>
  selectedCategoryId.value === ALL_KEY ? 'all' : String(selectedCategoryId.value)
);

function onSelectCategory(tab: PageTab): void {
  selectCategory(tab.key === 'all' ? ALL_KEY : Number(tab.key));
}

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

// Справочник id → название категории (для подписи в карточке).
const categoryNameById = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {};
  for (const c of categories.value) map[Number(c.id)] = c.display_name;
  return map;
});

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
    category: categoryNameById.value[offer.category_id] ?? undefined,
    supplierName: offer.supplier_name ?? undefined,
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
    FailAlert(e);
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
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));
const orderDialogOpen = ref(false);
const orderDialogOffer = ref<MarketplaceOfferView | null>(null);

function onSelectOffer(offer: MarketplaceOfferView): void {
  if (!canOrder(offer)) return;
  orderDialogOffer.value = offer;
  orderDialogOpen.value = true;
}

// Клик по карточке открывает страницу с полным описанием предложения; быстрый
// заказ остаётся на кнопке «Заказать» (диалог поверх каталога).
function goToDetail(offer: MarketplaceOfferView): void {
  void router.push({
    name: 'marketplace-offer-detail',
    params: { coopname: coopname.value, offerId: offer.id },
  });
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

  PageTabs.catalog__tabs(
    :tabs="categoryTabs",
    :active-key="activeCategoryKey",
    @select="onSelectCategory"
  )
    template(#actions)
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
        CatalogOfferCard(:offer="toCatalogOffer(o)", @click="goToDetail(o)")
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
  // Воздух сверху как на столе поставщика — единый канон столов: контент
  // (меню/баннер) отделяется от топбара. Контент ниже разводит flex-gap.
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // Канон-`.tabbar` тянется во всю ширину; гасим его внутренний горизонтальный
  // паддинг, чтобы вкладки шли от края страницы (у страницы свои отступы).
  &__tabs {
    margin: 0 calc(-1 * var(--p-6, 24px));

    :deep(.tabbar__tabs) {
      padding: 0 var(--p-6, 24px);
    }
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
