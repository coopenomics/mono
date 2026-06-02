<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { BaseSelect, BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { KUHeaderBar } from 'src/widgets/Marketplace/KUHeaderBar';
import { KUSelector } from 'src/widgets/Marketplace/KUSelector';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
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
import AddToCartDialog from './AddToCartDialog.vue';

/**
 * Story 3.5: каталог Стола заказов на orderer-столе.
 *
 * Канон UI — `widgets/Marketplace/CatalogOfferCard` (карточка предложения).
 *
 * Эпик 16: каталог КУ-scoped. Заказчик СНАЧАЛА выбирает пункт выдачи (КУ),
 * витрина фильтруется по нему (`delivery_braname`) — показываются только
 * товары, доставимые на этот КУ. КУ виден в шапке (`KUHeaderBar`) и меняется
 * там же. Действие на карточке — «В корзину» (товар кладётся в корзину с
 * текущим КУ), оформление — отдельным шагом на странице корзины.
 */

const ALL_KEY = -1 as number;
const PAGE_SIZE = 24;

const cartStore = useMarketplaceCartStore();

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
      delivery_braname: cartStore.currentBraname,
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
const cartDialogOpen = ref(false);
const cartDialogOffer = ref<MarketplaceOfferView | null>(null);

// Каталог КУ-scoped: пока пункт выдачи не выбран — витрину не показываем,
// сначала выбор КУ (легаси-заказчики без КУ + страховка). pickedBraname —
// локальный выбор в этом стартовом экране до применения.
const needsKU = computed(() => !cartStore.currentBraname);
const pickedBraname = ref<string | null>(null);
const applyingKU = ref(false);

function onSelectOffer(offer: MarketplaceOfferView): void {
  if (!canOrder(offer)) return;
  cartDialogOffer.value = offer;
  cartDialogOpen.value = true;
}

// Клик по карточке открывает страницу с полным описанием предложения; быстрый
// заказ остаётся на кнопке «Заказать» (диалог поверх каталога).
function goToDetail(offer: MarketplaceOfferView): void {
  void router.push({
    name: 'marketplace-offer-detail',
    params: { coopname: coopname.value, offerId: offer.id },
  });
}

// Перезагрузка витрины под текущий КУ (категории зависят от КУ-фильтра).
async function reloadCatalog(): Promise<void> {
  currentPage.value = 1;
  await Promise.all([loadCategories(), loadPage(false)]);
}

// Применить выбранный на стартовом экране КУ → фиксируем в корзине и грузим витрину.
async function applyInitialKU(): Promise<void> {
  if (!pickedBraname.value) return;
  applyingKU.value = true;
  try {
    await cartStore.changeDeliveryPoint(pickedBraname.value);
    await reloadCatalog();
  } catch (e) {
    FailAlert(e);
  } finally {
    applyingKU.value = false;
  }
}

// КУ сменили в шапке — перегружаем витрину под новый пункт выдачи.
async function onKUChanged(): Promise<void> {
  await reloadCatalog();
}

onMounted(async () => {
  // Корзина хранит текущий КУ — грузим её первой. Если КУ уже выбран
  // (присоединение или прошлый визит) — сразу показываем витрину под него.
  await cartStore.load();
  if (cartStore.currentBraname) {
    await loadCategories();
    await loadPage(false);
  }
});
</script>

<template lang="pug">
q-page.catalog(role="region", aria-label="Каталог Стола заказов")
  KUHeaderBar(:coopname="coopname", @changed="onKUChanged")

  //- КУ ещё не выбран: сначала выбор пункта выдачи, витрина скрыта —
  //- модель «сначала КУ, потом каталог, отфильтрованный под него».
  BaseCard.catalog__pick-ku(
    v-if="needsKU",
    title="Выберите пункт выдачи",
    subtitle="Каталог покажет товары, которые возят на выбранный кооперативный участок. Пункт можно сменить в любой момент в шапке стола."
  )
    KUSelector(v-model="pickedBraname", :coopname="coopname")
    .catalog__pick-actions
      BaseButton(
        variant="primary",
        :disabled="!pickedBraname",
        :loading="applyingKU",
        @click="applyInitialKU"
      ) Открыть каталог

  template(v-else)
    PageHint(storage-key="mp:catalog:banner-dismissed")
      | Предложения поставщиков, доставимые на ваш пункт выдачи. Добавляйте товары в корзину — оформление одним заказом на странице корзины.

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
              ) В корзину
      template(#loading)
        .row.justify-center.q-my-md
          q-spinner(color="primary", size="2em")

  AddToCartDialog(
    v-model="cartDialogOpen",
    :offer="cartDialogOffer"
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

  &__pick-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-4, 16px);
  }
}

@media (max-width: 768px) {
  .catalog {
    padding: var(--p-4, 16px);
  }
}
</style>
