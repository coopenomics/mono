<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import {
  CatalogOfferCard,
  type CatalogOffer,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import {
  OfferDetailsDialog,
  type OfferDetail,
} from 'src/widgets/Marketplace/OfferDetailsDialog';
import {
  approveOffer,
  fetchPendingOffers,
  rejectOffer,
  type MarketplacePendingOfferView,
} from '../api';

/**
 * Эпик 3 / Story 3.6: модерация offer'ов председателем кооператива.
 *
 * Лента offer'ов в статусе PENDING_MODERATION. По «Одобрить» вызывается
 * `marketplaceApproveOffer`, статус становится APPROVED, offer пропадает из
 * ленты (фильтр на бэкенде) и появляется в публичном каталоге Story 3.5.
 *
 * Канон UI — `widgets/Marketplace/CatalogOfferCard` (UX-DR10) с per-card
 * action-кнопкой «Одобрить» через slot `actions`. Корневой класс
 * `mp-role-admin` подтягивает токены admin-стола из `marketplace-tokens.scss`.
 */

const PAGE_SIZE = 24;

const items = ref<MarketplacePendingOfferView[]>([]);
const total = ref(0);
const loading = ref(false);
const approving = ref<Set<string>>(new Set());
const rejecting = ref<Set<string>>(new Set());
const currentPage = ref(1);

// Справочник категорий (id → название) для детального просмотра.
const categoryNames = ref<Record<number, string>>({});

// Детальный просмотр предложения — клик по карточке открывает модалку
// с полным описанием и действиями (одобрить / отклонить).
const detailsOpen = ref(false);
const selected = ref<MarketplacePendingOfferView | null>(null);

const hasMore = computed(() => items.value.length < total.value);

const UNIT_LABEL: Record<MarketplacePendingOfferView['unit_of_measure'], string> = {
  piece: 'шт',
  kg: 'кг',
  liter: 'л',
  pack: 'упак',
};

function toCatalogOffer(offer: MarketplacePendingOfferView): CatalogOffer {
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    remainUnits: offer.unlimited_flag ? undefined : offer.quantity_available,
    unitCost: offer.price_per_unit,
    unitLabel: UNIT_LABEL[offer.unit_of_measure],
    status: 'moderation',
  };
}

const selectedDetail = computed<OfferDetail | null>(() => {
  const o = selected.value;
  if (!o) return null;
  const catId = o.category_id != null ? Number(o.category_id) : null;
  return {
    id: o.id,
    title: o.product_name,
    description: o.description ?? null,
    status: 'moderation',
    unitCost: o.price_per_unit,
    unitLabel: UNIT_LABEL[o.unit_of_measure],
    remainUnits: o.unlimited_flag ? undefined : o.quantity_available,
    unlimited: o.unlimited_flag,
    categoryName: catId != null ? categoryNames.value[catId] ?? null : null,
    cycleType: o.cycle_type,
    warrantyDays: o.warranty_days,
    supplierAccount: o.supplier_account,
  };
});

function openDetails(offer: MarketplacePendingOfferView): void {
  selected.value = offer;
  detailsOpen.value = true;
}

async function loadCategories(): Promise<void> {
  try {
    const { [Queries.Marketplace.ListCategories.name]: cats } = await client.Query(
      Queries.Marketplace.ListCategories.query,
    );
    const map: Record<number, string> = {};
    for (const c of cats ?? []) map[Number(c.id)] = c.display_name;
    categoryNames.value = map;
  } catch {
    // Справочник категорий не критичен для модерации — просто не покажем название.
  }
}

async function loadPage(append: boolean): Promise<void> {
  loading.value = true;
  try {
    const page = await fetchPendingOffers({
      page: currentPage.value,
      limit: PAGE_SIZE,
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

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  currentPage.value += 1;
  await loadPage(true);
}

function onApprove(offer: MarketplacePendingOfferView): void {
  Dialog.create({
    title: 'Одобрить предложение?',
    message: `«${offer.product_name}» появится в публичном каталоге кооператива.`,
    ok: { label: 'Одобрить', color: 'primary', unelevated: true, noCaps: true },
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    persistent: true,
  }).onOk(async () => {
    approving.value.add(offer.id);
    try {
      await approveOffer(offer.id);
      items.value = items.value.filter((o) => o.id !== offer.id);
      total.value = Math.max(0, total.value - 1);
      detailsOpen.value = false;
      Notify.create({
        type: 'positive',
        message: `Предложение «${offer.product_name}» одобрено`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message });
    } finally {
      approving.value.delete(offer.id);
    }
  });
}

function onReject(offer: MarketplacePendingOfferView): void {
  Dialog.create({
    title: 'Отклонить предложение?',
    message: `Укажите причину отказа по «${offer.product_name}» — она будет видна поставщику в «Мои предложения».`,
    prompt: {
      model: '',
      type: 'textarea',
      isValid: (val: string) => val.trim().length > 0,
      label: 'Причина отказа',
      counter: true,
      maxlength: 1000,
    },
    ok: { label: 'Отклонить', color: 'negative', unelevated: true, noCaps: true },
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    persistent: true,
  }).onOk(async (reason: string) => {
    rejecting.value.add(offer.id);
    try {
      await rejectOffer(offer.id, reason.trim());
      items.value = items.value.filter((o) => o.id !== offer.id);
      total.value = Math.max(0, total.value - 1);
      detailsOpen.value = false;
      Notify.create({
        type: 'positive',
        message: `Предложение «${offer.product_name}» отклонено`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message });
    } finally {
      rejecting.value.delete(offer.id);
    }
  });
}

onMounted(async () => {
  await Promise.all([loadPage(false), loadCategories()]);
});
</script>

<template lang="pug">
q-page.mp-role-admin.mp-moderation-page(role="region", aria-label="Модерация предложений")
  div.mp-moderation-page__header
    div
      div.text-h5 Модерация предложений
      div.text-caption.mp-moderation-page__subtitle
        | Предложения поставщиков ожидают вашего одобрения. После «Одобрить» товар появится в публичном каталоге кооператива.
    q-space
    q-chip(outline, color="warning")
      q-icon(name="fa-solid fa-hourglass-half", left)
      | На модерации: {{ total }}

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-moderation-page__empty(v-if="!loading && items.length === 0")
    q-icon(name="fa-regular fa-circle-check", size="3em", color="positive")
    div.text-subtitle1 Очередь модерации пуста
    div.text-caption Все предложения поставщиков рассмотрены

  div.mp-moderation-page__hint(v-if="!loading && items.length > 0")
    q-icon(name="fa-regular fa-hand-pointer", size="14px")
    | Нажмите на карточку, чтобы прочитать описание и принять решение.

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    div.row.q-col-gutter-md
      div.col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="toCatalogOffer(o)", @click="openDetails(o)")
          template(v-slot:actions)
            q-btn(
              unelevated,
              dense,
              no-caps,
              color="primary",
              icon="fa-solid fa-check",
              label="Одобрить",
              :loading="approving.has(o.id)",
              @click.stop="onApprove(o)"
            )
    template(v-slot:loading)
      div.row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")

  OfferDetailsDialog(v-model="detailsOpen", :offer="selectedDetail")
    template(v-if="selected", v-slot:actions)
      q-btn(
        flat,
        no-caps,
        color="negative",
        icon="fa-solid fa-xmark",
        label="Отклонить",
        :loading="rejecting.has(selected.id)",
        @click="onReject(selected)"
      )
      q-btn(
        unelevated,
        no-caps,
        color="primary",
        icon="fa-solid fa-check",
        label="Одобрить",
        :loading="approving.has(selected.id)",
        @click="onApprove(selected)"
      )
</template>

<style scoped lang="scss">
.mp-moderation-page {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--mp-space-md);
  }

  &__subtitle {
    color: var(--mp-on-surface-muted);
    max-width: 640px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--mp-space-xs);
    padding: var(--mp-space-xxl) var(--mp-space-md);
    color: var(--mp-on-surface-muted);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: var(--mp-space-xs);
    color: var(--mp-on-surface-muted);
    font-size: 12px;
  }
}
</style>
