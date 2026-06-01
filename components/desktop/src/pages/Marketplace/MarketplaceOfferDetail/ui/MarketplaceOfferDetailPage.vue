<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton, BaseBadge, EmptyState } from 'src/shared/ui/base';
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { fetchCategories } from '../../MarketplaceCatalog/api';
import OrderCreateDialog from '../../MarketplaceCatalog/ui/OrderCreateDialog.vue';
import { fetchOffer } from '../api';
import type { MarketplaceOfferDetailView } from '../types';

/**
 * Эпик 15: страница полного описания предложения. Карточка каталога несёт лишь
 * категорию + поставщика + краткое описание; всё остальное (полное описание без
 * ограничения длины, участки поставки с минимальным объёмом, гарантия, галерея)
 * раскрывается здесь по клику на карточку. Заказ оформляется тем же диалогом,
 * что и из каталога.
 */

const route = useRoute();
const router = useRouter();
const system = useSystemStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const offerId = computed(() => String(route.params.offerId ?? ''));

// Режим просмотра модератором (стол администратора): страница только для
// чтения — кнопки «Заказать» нет, «назад» ведёт в «Модерацию», а не в каталог.
const readonly = computed(() => route.meta?.readonly === true);

const offer = ref<MarketplaceOfferDetailView | null>(null);
const loading = ref(false);
const categoryNames = ref<Record<number, string>>({});

const orderDialogOpen = ref(false);

const images = computed(() => (offer.value ? marketplaceOfferImageUrls(offer.value.images) : []));

const unitShort = computed(() =>
  offer.value ? marketplaceUnitShort(offer.value.unit_of_measure) : '',
);

const categoryLabel = computed(() => {
  const id = offer.value?.category_id;
  return id != null ? categoryNames.value[id] ?? null : null;
});

const isEmpty = computed(
  () => !!offer.value && !offer.value.unlimited_flag && offer.value.quantity_available <= 0,
);
const canOrder = computed(
  () => !!offer.value && (offer.value.unlimited_flag || offer.value.quantity_available > 0),
);
const stockLabel = computed(() => {
  if (!offer.value) return '';
  if (offer.value.unlimited_flag) return 'Без ограничения остатка';
  return isEmpty.value
    ? 'Нет в наличии'
    : `В наличии: ${offer.value.quantity_available} ${unitShort.value}`;
});

const priceLabel = computed(() =>
  offer.value
    ? `${Number(offer.value.price_per_unit).toLocaleString('ru-RU')} ${system.governSymbol} / ${unitShort.value}`
    : '',
);

const deliveryPoints = computed(() =>
  (offer.value?.delivery_points ?? []).map((p) => ({
    key: p.braname,
    name: p.name ?? p.braname,
    volume: `от ${p.min_supply_volume} ${unitShort.value}`,
  })),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [o, cats] = await Promise.all([fetchOffer(offerId.value), fetchCategories()]);
    offer.value = o;
    const map: Record<number, string> = {};
    for (const c of cats) map[Number(c.id)] = c.display_name;
    categoryNames.value = map;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else {
    const name = readonly.value ? 'marketplace-moderation' : 'marketplace-catalog';
    void router.push({ name, params: { coopname: coopname.value } });
  }
}

async function onOrderCreated(): Promise<void> {
  await load();
}

onMounted(load);
</script>

<template lang="pug">
q-page.offer-detail(role="region", aria-label="Описание предложения")
  .offer-detail__back
    BaseButton(variant="ghost", size="sm", @click="goBack")
      template(#icon-left)
        q-icon(name="arrow_back", size="16px")
      | {{ readonly ? 'К модерации' : 'К каталогу' }}

  q-inner-loading(:showing="loading")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!loading && !offer",
    title="Предложение не найдено",
    body="Возможно, оно снято с публикации."
  )
    template(#icon)
      q-icon(name="search_off", size="48px")

  .offer-detail__grid(v-if="offer")
    //- Галерея (канон-виджет OfferGallery — единая карусель на всех экранах)
    .offer-detail__media
      OfferGallery(:images="images", :alt="offer.product_name", height="360px", placeholder-icon-size="64px")

    //- Сводка
    .offer-detail__summary
      .offer-detail__badges
        BaseBadge(v-if="categoryLabel", variant="neutral") {{ categoryLabel }}
        BaseBadge(:variant="isEmpty ? 'neutral' : 'pos'", dot) {{ stockLabel }}

      h1.offer-detail__title {{ offer.product_name }}

      .offer-detail__supplier(v-if="offer.supplier_name")
        q-icon(name="storefront", size="16px")
        span {{ offer.supplier_name }}

      .offer-detail__price {{ priceLabel }}

      BaseButton(
        v-if="!readonly",
        variant="primary",
        :disabled="!canOrder",
        @click="orderDialogOpen = true"
      ) Заказать

  .offer-detail__sections(v-if="offer")
    section.offer-detail__section(v-if="offer.description")
      .offer-detail__section-head Описание
      .offer-detail__desc {{ offer.description }}

    section.offer-detail__section(v-if="deliveryPoints.length")
      .offer-detail__section-head Участки поставки
      ul.offer-detail__points
        li.offer-detail__point(v-for="p in deliveryPoints", :key="p.key")
          span.offer-detail__point-name {{ p.name }}
          span.offer-detail__point-vol {{ p.volume }}

    section.offer-detail__section(v-if="offer.warranty_days > 0")
      .offer-detail__section-head Гарантия
      .offer-detail__desc {{ offer.warranty_days }} дн.

  OrderCreateDialog(
    v-if="!readonly",
    v-model="orderDialogOpen",
    :coopname="coopname",
    :offer="offer",
    @created="onOrderCreated"
  )
</template>

<style scoped lang="scss">
.offer-detail {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__back {
    align-self: flex-start;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--p-5, 20px);
    align-items: start;
  }

  &__media {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-lg, 12px);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__placeholder {
    height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__summary {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  &__title {
    font-size: var(--p-fs-h2);
    font-weight: 600;
    line-height: 1.25;
    color: var(--p-ink-1);
    margin: 0;
  }

  &__supplier {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__price {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-primary-strong);
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
    max-width: 720px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__section-head {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink-1);
  }

  &__desc {
    color: var(--p-ink-2);
    line-height: 1.55;
    white-space: pre-wrap;
  }

  &__points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__point {
    display: flex;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);
  }

  &__point-name {
    color: var(--p-ink-1);
  }

  &__point-vol {
    color: var(--p-ink-3);
    flex-shrink: 0;
  }
}

@media (max-width: 900px) {
  .offer-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .offer-detail {
    padding: var(--p-4, 16px);
  }
}
</style>
