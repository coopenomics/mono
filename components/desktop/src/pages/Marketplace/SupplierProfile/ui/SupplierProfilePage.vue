<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { useFirstLoad } from 'src/shared/lib/composables';
import { getMembershipFeePercent, marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { AccountBadge } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import {
  loadSupplierProfile,
  type MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { CatalogOfferCard, CatalogOfferCardSkeleton } from 'src/widgets/Marketplace/CatalogOfferCard';
import { ReviewStars } from 'src/widgets/Marketplace/ReviewStars';
import { ReviewSummary } from 'src/widgets/Marketplace/ReviewSummary';
import { SupplierProfileHead } from 'src/widgets/Marketplace/SupplierProfileHead';
import { canOrderOffer, toCatalogOffer, type MarketplaceOfferView } from '../../MarketplaceCatalog';
import { fetchCatalog, fetchCategories } from '../../MarketplaceCatalog/api';
import AddToCartDialog from '../../MarketplaceCatalog/ui/AddToCartDialog.vue';

/**
 * Страница поставщика: кто он, что поставляет и что о нём говорят заказчики.
 * Открывается с имени поставщика на карточке каталога и на странице
 * предложения. Показывает все его предложения, доступные к заказу; у
 * кооператива — имущество со склада.
 *
 * Экран сверху вниз: шапка поставщика (обложка → контекст → имя → оценка →
 * числа полосой), вкладки, один раздел — имущество, отзывы либо рассказ о
 * себе. Пустой раздел — короткая строка, а не экран-заглушка.
 */
const PAGE_SIZE = 24;
const SKELETON_COUNT = 4;

const route = useRoute();
const router = useRouter();
const cartStore = useMarketplaceCartStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const account = computed(() => String(route.params.account ?? ''));

// Стол администратора открывает ту же страницу для чтения: корзины там нет,
// карточка предложения ведёт в его реестр.
const readonly = computed(() => route.meta?.readonly === true);
const offerRouteName = computed(() =>
  readonly.value ? 'marketplace-admin-offer-detail' : 'marketplace-offer-detail',
);

const profile = ref<MarketplaceSupplierProfileView | null>(null);
const offers = ref<MarketplaceOfferView[]>([]);
const offersTotal = ref(0);
const offersShown = ref(PAGE_SIZE);
const categoryNames = ref<Record<number, string>>({});
const feePercent = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const firstLoad = useFirstLoad(loading);

const hasMoreOffers = computed(() => offers.value.length < offersTotal.value);
// В корзину нельзя, пока заказчик не выбрал пункт выдачи.
const needsKU = computed(() => !cartStore.currentBraname);

// Разделы страницы — вкладками: счётчик говорит, сколько в разделе, до захода в него.
type Section = 'offers' | 'reviews' | 'about';
const section = ref<Section>('offers');
const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    { key: 'offers', label: t('marketplace.supplierProfilePage.offersTitle'), count: profile.value?.offers_count ?? 0 },
    { key: 'reviews', label: t('marketplace.supplierProfilePage.reviewsTab'), count: profile.value?.reviews_count ?? 0 },
  ];
  if (profile.value?.about) list.push({ key: 'about', label: t('marketplace.supplierProfilePage.aboutTitle') });
  return list;
});

function onSelectTab(tab: PageTab): void {
  section.value = tab.key as Section;
}

const hasReviews = computed(() => (profile.value?.reviews_count ?? 0) > 0);
const backLabel = computed(() =>
  readonly.value ? t('marketplace.supplierProfilePage.backToSuppliers') : t('marketplace.supplierProfilePage.backToCatalog'),
);

const cartDialogOpen = ref(false);
const cartDialogOffer = ref<MarketplaceOfferView | null>(null);

async function loadOffers(): Promise<void> {
  const page = await fetchCatalog({
    supplier_account: account.value,
    page: 1,
    limit: offersShown.value,
    sort: 'created_at_desc',
    // Заказчик видит то, что доставят на его пункт выдачи; администратор — всё.
    delivery_braname: readonly.value ? null : cartStore.currentBraname,
  });
  offers.value = page.items;
  offersTotal.value = page.totalCount;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [loaded] = await Promise.all([loadSupplierProfile(account.value), loadOffers()]);
    profile.value = loaded;
  } catch (e) {
    profile.value = null;
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function showMoreOffers(): Promise<void> {
  if (!hasMoreOffers.value || loadingMore.value) return;
  loadingMore.value = true;
  offersShown.value += PAGE_SIZE;
  try {
    await loadOffers();
  } catch (e) {
    FailAlert(e);
  } finally {
    loadingMore.value = false;
  }
}

function goToOffer(offer: MarketplaceOfferView): void {
  void router.push({ name: offerRouteName.value, params: { coopname: coopname.value, offerId: offer.id } });
}

function onSelectOffer(offer: MarketplaceOfferView): void {
  if (!canOrderOffer(offer) || needsKU.value) return;
  cartDialogOffer.value = offer;
  cartDialogOpen.value = true;
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else {
    void router.push({
      name: readonly.value ? 'marketplace-suppliers' : 'marketplace-catalog',
      params: { coopname: coopname.value },
    });
  }
}

async function loadCategoryNames(): Promise<void> {
  try {
    const map: Record<number, string> = {};
    for (const c of await fetchCategories()) map[Number(c.id)] = c.display_name;
    categoryNames.value = map;
  } catch {
    // Без справочника карточки стоят без подписи категории.
  }
}

async function loadFeePercent(): Promise<void> {
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки карточки показывают цену поставщика.
  }
}

// Профиль правит поставщик, предложения публикует модератор, отзывы пишут
// заказчики — страница подхватывает всё это без перезагрузки.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useLiveReload(marketLiveTables('offer', 'supplier', 'review'), () => reloadLive());

// С отзыва на странице можно перейти к другому поставщику — та же страница,
// другой адрес.
watch(account, () => {
  offersShown.value = PAGE_SIZE;
  section.value = 'offers';
  void load();
});

onMounted(async () => {
  void loadFeePercent();
  void loadCategoryNames();
  if (!readonly.value) {
    try {
      await cartStore.load();
    } catch {
      // Без корзины пункт выдачи не выбран: предложения видны, заказ закрыт.
    }
  }
  await load();
});
</script>

<template lang="pug">
q-page.supplier-profile(role="region", :aria-label="$t('marketplace.supplierProfilePage.ariaLabel')")
  template(v-if="firstLoad")
    q-skeleton(type="rect", height="260px")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="n in SKELETON_COUNT", :key="`skel-${n}`")
        CatalogOfferCardSkeleton

  BaseCard(v-else-if="!profile")
    EmptyState(
      :title="$t('marketplace.supplierProfilePage.notFoundTitle')",
      :body="$t('marketplace.supplierProfilePage.notFoundBody')"
    )
      template(#icon)
        q-icon(name="search_off", size="22px")
      template(#action)
        BaseButton(variant="secondary", size="sm", @click="goBack") {{ backLabel }}

  template(v-else)
    SupplierProfileHead(:profile="profile")
      template(#context)
        //- Возврат — первой крошкой строки контекста, внутри карточки.
        button.supplier-profile__back(type="button", @click="goBack")
          q-icon(name="arrow_back", size="14px")
          span {{ backLabel }}
        span(aria-hidden="true") ·
        span {{ profile.is_cooperative ? $t('marketplace.supplierProfileHead.eyebrowCooperative') : $t('marketplace.supplierProfileHead.eyebrowSupplier') }}
      template(v-if="hasReviews || readonly", #facts)
        ReviewStars(:rating="profile.rating_avg", :count="profile.reviews_count")
        AccountBadge(v-if="readonly", :account-name="profile.supplier_account", size="sm")

    PageTabs.supplier-profile__tabs(:tabs="tabs", :active-key="section", @select="onSelectTab")

    //- Имущество: карточки каталога, как на витрине.
    template(v-if="section === 'offers'")
      .supplier-profile__empty(v-if="offers.length === 0")
        q-icon(name="inventory_2", size="22px")
        .supplier-profile__empty-title {{ $t('marketplace.supplierProfilePage.offersEmptyTitle') }}
        .supplier-profile__empty-body {{ $t('marketplace.supplierProfilePage.offersEmptyBody') }}
      template(v-else)
        .supplier-profile__note(v-if="!readonly && needsKU")
          q-icon(name="info", size="18px")
          span {{ $t('marketplace.supplierProfilePage.selectPvzHint') }}
        .row.q-col-gutter-md
          .col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in offers", :key="o.id")
            CatalogOfferCard(
              :offer="toCatalogOffer(o, categoryNames)",
              :fee-percent="feePercent",
              :show-fee-note="false",
              @click="goToOffer(o)"
            )
              template(v-if="!readonly", #actions)
                BaseButton(
                  variant="primary",
                  size="sm",
                  :disabled="!canOrderOffer(o) || needsKU",
                  @click.stop="onSelectOffer(o)"
                ) {{ $t('marketplace.supplierProfilePage.addToCartAction') }}
        .supplier-profile__more(v-if="hasMoreOffers")
          BaseButton(variant="secondary", size="sm", :loading="loadingMore", @click="showMoreOffers") {{ $t('marketplace.supplierProfilePage.showMoreAction') }}

    //- Отзывы: сводка и список в одной карточке; без отзывов — тихая строка.
    template(v-else-if="section === 'reviews'")
      .supplier-profile__empty(v-if="!hasReviews")
        q-icon(name="rate_review", size="22px")
        .supplier-profile__empty-title {{ $t('marketplace.reviewList.emptyTitle') }}
        .supplier-profile__empty-body {{ $t('marketplace.reviewList.emptyBody') }}
      BaseCard(v-else)
        ReviewSummary(:supplier-account="account", :offer-route-name="offerRouteName")

    BaseCard(v-else)
      .supplier-profile__about {{ profile.about }}

  AddToCartDialog(
    v-if="!readonly",
    v-model="cartDialogOpen",
    :offer="cartDialogOffer",
    :fee-percent="feePercent"
  )
</template>

<style scoped lang="scss">
.supplier-profile {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__back {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1);
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--p-ink-2);
    cursor: pointer;

    &:hover {
      color: var(--p-primary);
    }

    &:focus-visible {
      outline: 1px solid var(--p-primary);
      outline-offset: var(--p-1);
      border-radius: var(--p-r-sm);
    }
  }

  // Первая вкладка стоит по левому краю карточек: у полосы свои боковые поля
  // рассчитаны на страницу без отступов.
  :deep(.supplier-profile__tabs .tabbar__tabs) {
    padding: 0;
  }

  // Пустой раздел — короткий тихий блок на холсте, без коробки.
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--p-2);
    padding: var(--p-9) var(--p-6);
    text-align: center;
    color: var(--p-ink-3);
  }

  &__empty-title {
    margin-top: var(--p-1);
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__empty-body,
  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__note {
    display: flex;
    align-items: center;
    gap: var(--p-2);
  }

  &__about {
    max-width: 72ch;
    font-size: var(--p-fs-body);
    line-height: 1.6;
    color: var(--p-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__more {
    display: flex;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .supplier-profile {
    padding: var(--p-4);
  }
}
</style>
