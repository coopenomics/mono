<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import {
  CatalogOfferCard,
  CatalogOfferCardSkeleton,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { KUHeaderBar } from 'src/widgets/Marketplace/KUHeaderBar';
import { CartHeaderButton } from 'src/widgets/Marketplace/CartHeaderButton';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { getMembershipFeePercent } from 'src/shared/lib/marketplace';
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
 * Эпик 16: каталог КУ-scoped, но витрина видна ВСЕГДА.
 *  - КУ выбран → витрина фильтруется по нему (`delivery_braname`): только
 *    доставимое на этот пункт. Действие — «В корзину».
 *  - КУ НЕ выбран (гость/ещё не выбрал) → показываем ВСЕ товары кооператива с
 *    указанием, на каких КУ они есть (offer.delivery_points). Заказ при этом
 *    недоступен: «В корзину» заблокирована, пока пункт выдачи не выбран в шапке
 *    (`KUHeaderBar`). Так гость видит ассортимент, не выбирая КУ.
 */

const ALL_KEY = -1 as number;
const PAGE_SIZE = 24;

const cartStore = useMarketplaceCartStore();

const categories = ref<MarketplaceCategoryView[]>([]);
const counts = ref<Map<number, number>>(new Map());
const items = ref<MarketplaceOfferView[]>([]);
const total = ref(0);
const loading = ref(false);
// Кол-во скелетон-карточек на первичной загрузке витрины.
const SKELETON_COUNT = 8;
const selectedCategoryId = ref<number>(ALL_KEY);
const sort = ref<CatalogSort>('created_at_desc');
const currentPage = ref(1);

const hasMore = computed(() => items.value.length < total.value);

const totalActiveCount = computed(() =>
  Array.from(counts.value.values()).reduce((acc, v) => acc + v, 0)
);

// Категории как канон-вкладки (`PageTabs` со счётчиком). `key` — строковый id
// категории (или 'all'), счётчик — число доступных к заказу товаров. Пустые
// категории (count == 0) НЕ показываем — заказчику ни к чему категории, в
// которых под его пунктом выдачи ничего нет. Счётчики КУ-скоупные (бэкенд),
// поэтому фильтр следует за выбранным пунктом.
const categoryTabs = computed<PageTab[]>(() => [
  { key: 'all', label: 'Все', count: totalActiveCount.value },
  ...categories.value
    .filter((cat) => (counts.value.get(cat.id) ?? 0) > 0)
    .map((cat) => ({
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

const currentSortLabel = computed(
  () => sortOptions.find((o) => o.value === sort.value)?.label ?? 'Сортировка',
);

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
    // Остаток склада кооператива (requirement 76): мгновенная выдача, без цикла поставки.
    coopStock: Boolean(offer.stock_braname),
  };
}

function canOrder(offer: MarketplaceOfferView): boolean {
  return offer.unlimited_flag || offer.quantity_available > 0;
}

async function loadCategories(): Promise<void> {
  // Счётчики КУ-скоупим текущим пунктом выдачи — пустые на нём категории уйдут
  // из вкладок (categoryTabs фильтрует count==0). Без КУ (гость) — глобально.
  const [cats, cc] = await Promise.all([
    fetchCategories(),
    fetchCategoryOfferCounts(cartStore.currentBraname),
  ]);
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

// Пункт выдачи не выбран: витрину всё равно показываем (режим просмотра/гостя),
// но заказ недоступен — нужен КУ. КУ выбирается в шапке (KUHeaderBar).
const needsKU = computed(() => !cartStore.currentBraname);

// Названия КУ, на которые доставим оффер — для подписи на карточке в режиме
// просмотра без выбранного пункта выдачи (показываем «где это есть»).
function offerKUNames(offer: MarketplaceOfferView): string[] {
  const seen = new Set<string>();
  for (const p of offer.delivery_points ?? []) {
    seen.add(p.name || p.braname);
  }
  return [...seen];
}

function onSelectOffer(offer: MarketplaceOfferView): void {
  if (!canOrder(offer) || needsKU.value) return;
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
// Категории грузим первыми: если выбранная категория опустела на новом пункте
// (её вкладка исчезнет), сбрасываемся на «Все», иначе подсветка повиснет на
// несуществующей вкладке, а витрина покажет пустой EmptyState.
async function reloadCatalog(): Promise<void> {
  currentPage.value = 1;
  await loadCategories();
  if (
    selectedCategoryId.value !== ALL_KEY &&
    (counts.value.get(selectedCategoryId.value) ?? 0) === 0
  ) {
    selectedCategoryId.value = ALL_KEY;
  }
  await loadPage(false);
}

// КУ сменили в шапке — перегружаем витрину под новый пункт выдачи.
async function onKUChanged(): Promise<void> {
  await reloadCatalog();
}


// requirement b6: ставка членского взноса для отображения цены «с взносом».
const feePercent = ref(0);

async function loadFeePercent(): Promise<void> {
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Ставка не критична для витрины — без неё показываем базовые цены.
  }
}

onMounted(async () => {
  void loadFeePercent();
  // Корзина хранит текущий КУ — грузим её первой (если упадёт, напр. у гостя
  // без orderer-прав, витрину всё равно показываем — без КУ-фильтра).
  try {
    await cartStore.load();
  } catch {
    // Без корзины currentBraname=null → витрина покажется целиком.
  }
  await loadCategories();
  await loadPage(false);
});

// ── Живая витрина: realtime-сигналы каталога (Фаза A) ──────────────────────
// Остаток меняется → точечно правим карточку по offer_id, без перезагрузки и
// мельтешения (частое событие). Новый оффер / catch-up → ненавязчивое обновление
// с сохранением уже загруженной глубины (НЕ сброс на первую страницу — иначе
// страховочный resync раз в 60с дёргал бы прокрутку у листающего пайщика).
function patchOfferStock(offerId: string, quantityAvailable: number, unlimited: boolean): void {
  const item = items.value.find((o) => o.id === offerId);
  if (!item) return; // оффер не на текущей вкладке/в загруженном диапазоне — пропуск
  item.quantity_available = quantityAvailable;
  item.unlimited_flag = unlimited;
}

async function refreshCatalogLiveNow(): Promise<void> {
  await loadCategories();
  if (
    selectedCategoryId.value !== ALL_KEY &&
    (counts.value.get(selectedCategoryId.value) ?? 0) === 0
  ) {
    selectedCategoryId.value = ALL_KEY;
    currentPage.value = 1;
  }
  // Перечитываем ровно загруженную глубину одним запросом (page=1, limit по
  // числу уже показанных) — состав/порядок/остатки свежие, новый оффер встаёт
  // на своё место по сортировке, прокрутка не прыгает. Тихо: при items>0
  // скелетон не показывается.
  const limit = Math.max(PAGE_SIZE, currentPage.value * PAGE_SIZE);
  loading.value = true;
  try {
    const page = await fetchCatalog({
      category_id: selectedCategoryId.value === ALL_KEY ? null : selectedCategoryId.value,
      page: 1,
      limit,
      sort: sort.value,
      delivery_braname: cartStore.currentBraname,
    });
    total.value = page.totalCount;
    items.value = page.items;
  } catch {
    // Фоновое обновление — молча; следующий сигнал/resync дочитает снова.
  } finally {
    loading.value = false;
  }
}

const refreshCatalogLive = debounce(() => {
  void refreshCatalogLiveNow();
}, 400);

useMarketplaceRealtime(
  {
    MarketplaceOfferStockChangedEvent: (e) =>
      patchOfferStock(e.offer_id, e.quantity_available, e.unlimited_flag),
    MarketplaceOfferPublishedEvent: () => refreshCatalogLive(),
  },
  { onResync: () => refreshCatalogLive() }
);
</script>

<template lang="pug">
q-page.catalog(role="region", aria-label="Каталог Стола заказов")
  //- Индикатор корзины в шапке стола (Story 16.1) — общий header-виджет,
  //- переиспользуется и на странице предложения.
  CartHeaderButton(:coopname="coopname")

  //- Бар пункта выдачи (КУ всегда на виду). Инфо-баннер убран — назначение
  //- каталога очевидно из контекста.
  KUHeaderBar(:coopname="coopname", @changed="onKUChanged")

  //- КУ не выбран — режим просмотра витрины целиком (гость). Поясняем, что для
  //- заказа нужно выбрать пункт выдачи (кнопка «Выбрать пункт» в шапке выше).
  .catalog__guest-note(v-if="needsKU")
    q-icon(name="info", size="18px")
    span Показаны все товары кооператива. Чтобы заказывать и отфильтровать витрину под себя — выберите пункт выдачи в шапке.

  PageTabs.catalog__tabs(
    :tabs="categoryTabs",
    :active-key="activeCategoryKey",
    @select="onSelectCategory"
  )
    template(#actions)
      //- Сортировка — ghost-кнопка с меню, НЕ bordered-селект: коробка q-field
      //- выше строки табов и ломает высоту полосы. Кнопка центрируется в actions
      //- и не добавляет вертикали (канон: в actions табов — компактные кнопки).
      BaseButton.catalog__sort(variant="ghost", size="sm")
        template(#icon-left)
          q-icon(name="swap_vert", size="18px")
        span.catalog__sort-label {{ currentSortLabel }}
        q-icon(name="arrow_drop_down", size="18px")
        q-menu(anchor="bottom right", self="top right")
          q-list(dense, style="min-width: 180px")
            q-item(
              v-for="opt in sortOptions",
              :key="opt.value",
              clickable,
              v-close-popup,
              :active="opt.value === sort",
              @click="onSortChange(opt.value)"
            )
              q-item-section {{ opt.label }}

  //- Канон: на первичной загрузке — скелетон-сетка карточек, не перекрывающий
  //- спиннер. Polling обновляет молча.
  .row.q-col-gutter-md(v-if="loading && items.length === 0")
    .col-12.col-sm-6.col-md-4.col-lg-3(v-for="n in SKELETON_COUNT", :key="`skel-${n}`")
      CatalogOfferCardSkeleton

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
        CatalogOfferCard(:offer="toCatalogOffer(o)", :fee-percent="feePercent", :show-fee-note="false", @click="goToDetail(o)")
          template(v-if="needsKU && offerKUNames(o).length", #details)
            .catalog__offer-ku
              q-icon(name="location_on", size="14px")
              span Доступно в: {{ offerKUNames(o).join(', ') }}
          template(#actions)
            BaseButton(
              variant="primary",
              size="sm",
              :disabled="!canOrder(o) || needsKU",
              @click.stop="onSelectOffer(o)"
            ) В корзину
    template(#loading)
      .row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")

  AddToCartDialog(
    v-model="cartDialogOpen",
    :offer="cartDialogOffer",
    :fee-percent="feePercent"
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

    // Полоса табов с селектом сортировки в actions: держим её компактной, чтобы
    // вкладки шли сразу под баром ПВЗ, а не «висели» от высокого поля.
    :deep(.tabbar) {
      min-height: 44px;
      align-items: center;
    }
  }

  // Метка текущей сортировки в ghost-кнопке: серее заголовков, без переноса.
  &__sort-label {
    white-space: nowrap;
  }

  // Заметка режима просмотра без КУ (гость): на info-поверхности, не баннер.
  &__guest-note {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px) var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface-2);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  // Подпись «где это есть» на карточке оффера в режиме просмотра без КУ.
  &__offer-ku {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }
}

@media (max-width: 768px) {
  .catalog {
    padding: var(--p-4, 16px);
  }
}
</style>
