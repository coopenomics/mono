<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { getMembershipFeePercent, marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { Avatar, BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import {
  loadSupplierProfile,
  type MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { CatalogOfferCard, CatalogOfferCardSkeleton } from 'src/widgets/Marketplace/CatalogOfferCard';
import { ReviewStars } from 'src/widgets/Marketplace/ReviewStars';
import { ReviewSummary } from 'src/widgets/Marketplace/ReviewSummary';
import { canOrderOffer, toCatalogOffer, type MarketplaceOfferView } from '../../MarketplaceCatalog';
import { fetchCatalog, fetchCategories } from '../../MarketplaceCatalog/api';
import AddToCartDialog from '../../MarketplaceCatalog/ui/AddToCartDialog.vue';

/**
 * Страница поставщика: кто он, что поставляет и что о нём говорят заказчики.
 * Открывается с имени поставщика на карточке каталога и на странице
 * предложения. Показывает все его предложения, доступные к заказу; у
 * кооператива — имущество со склада.
 *
 * Зоны: опознание (обложка, имя) → оценка → числа → рассказ о себе →
 * имущество → отзывы.
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
  .supplier-profile__back
    BaseButton(variant="ghost", size="sm", @click="goBack")
      template(#icon-left)
        q-icon(name="arrow_back", size="16px")
      | {{ $t('marketplace.supplierProfilePage.backAction') }}

  template(v-if="firstLoad")
    q-skeleton(type="rect", height="160px")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="n in SKELETON_COUNT", :key="`skel-${n}`")
        CatalogOfferCardSkeleton

  EmptyState(
    v-else-if="!profile",
    :title="$t('marketplace.supplierProfilePage.notFoundTitle')",
    :body="$t('marketplace.supplierProfilePage.notFoundBody')"
  )
    template(#icon)
      q-icon(name="search_off", size="48px")

  template(v-else)
    //- Шапка: обложка → контекст → имя → оценка → числа под линией.
    BaseCard.supplier-profile__head
      .supplier-profile__hero
        .supplier-profile__cover
          q-img(v-if="profile.cover_url", :src="profile.cover_url", :ratio="1", fit="cover", :alt="profile.display_name")
          Avatar(v-else, :name="profile.display_name", size="xl")
        .supplier-profile__identity
          .supplier-profile__eyebrow
            | {{ profile.is_cooperative ? $t('marketplace.supplierProfilePage.eyebrowCooperative') : $t('marketplace.supplierProfilePage.eyebrowSupplier') }}
          h1.supplier-profile__name {{ profile.display_name }}
          ReviewStars(
            :rating="profile.rating_avg",
            :count="profile.reviews_count",
            :empty-text="$t('marketplace.supplierProfilePage.noReviews')"
          )
      .supplier-profile__stats
        .supplier-profile__stat
          .supplier-profile__stat-label {{ $t('marketplace.supplierProfilePage.offersLabel') }}
          .supplier-profile__stat-value {{ profile.offers_count }}
        .supplier-profile__stat
          .supplier-profile__stat-label {{ $t('marketplace.supplierProfilePage.reviewsLabel') }}
          .supplier-profile__stat-value {{ profile.reviews_count }}

    BaseCard(v-if="profile.about", :title="$t('marketplace.supplierProfilePage.aboutTitle')")
      .supplier-profile__about {{ profile.about }}

    section.supplier-profile__section
      h2.supplier-profile__section-head {{ $t('marketplace.supplierProfilePage.offersTitle') }}
      EmptyState(
        v-if="offers.length === 0",
        :title="$t('marketplace.supplierProfilePage.offersEmptyTitle')",
        :body="$t('marketplace.supplierProfilePage.offersEmptyBody')"
      )
        template(#icon)
          q-icon(name="inventory_2", size="40px")
      .row.q-col-gutter-md(v-else)
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
      .supplier-profile__note(v-if="!readonly && needsKU && offers.length")
        | {{ $t('marketplace.supplierProfilePage.selectPvzHint') }}

    BaseCard(:title="$t('marketplace.supplierProfilePage.reviewsTitle')")
      ReviewSummary(:supplier-account="account", :offer-route-name="offerRouteName")

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

  &__hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--p-5);
    align-items: center;
  }

  &__cover {
    width: 96px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--p-r-lg);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    min-width: 0;
  }

  &__eyebrow,
  &__stat-label {
    font-size: var(--p-fs-eyebrow);
    letter-spacing: var(--p-ls-eyebrow);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__name {
    margin: 0;
    font-size: var(--p-fs-h1);
    line-height: var(--p-lh-h1);
    font-weight: 700;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__stats {
    display: flex;
    gap: var(--p-7);
    flex-wrap: wrap;
    margin-top: var(--p-4);
    padding-top: var(--p-4);
    border-top: 1px solid var(--p-line);
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
  }

  &__stat-value {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }

  &__about {
    color: var(--p-ink-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-3);
  }

  &__section-head {
    margin: 0;
    font-size: var(--p-fs-h2);
    line-height: var(--p-lh-h2);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__more {
    display: flex;
    justify-content: center;
  }

  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }
}

@media (max-width: 768px) {
  .supplier-profile {
    padding: var(--p-4);
  }
}
</style>
