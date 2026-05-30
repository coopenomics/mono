<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
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
 * action-кнопкой «Одобрить» через slot `actions`.
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

function toCatalogOffer(offer: MarketplacePendingOfferView): CatalogOffer {
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    images: marketplaceOfferImageUrls(offer.images),
    remainUnits: offer.unlimited_flag ? undefined : offer.quantity_available,
    unitCost: offer.price_per_unit,
    unitLabel: marketplaceUnitShort(offer.unit_of_measure),
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
    unitLabel: marketplaceUnitShort(o.unit_of_measure),
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
q-page.moderation(role="region", aria-label="Модерация предложений")
  PageHint(storage-key="mp:moderation:banner-dismissed")
    | Предложения поставщиков ожидают вашего одобрения. После «Одобрить» товар появится в публичном каталоге кооператива.

  .moderation__toolbar
    q-space
    span.chip.chip--warn
      q-icon(name="hourglass_empty", size="14px")
      | На модерации: {{ total }}

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!loading && items.length === 0",
    title="Очередь модерации пуста",
    body="Все предложения поставщиков рассмотрены."
  )
    template(#icon)
      q-icon(name="check_circle", size="48px")

  .moderation__hint(v-if="!loading && items.length > 0")
    q-icon(name="touch_app", size="14px")
    | Нажмите на карточку, чтобы прочитать описание и принять решение.

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="toCatalogOffer(o)", @click="openDetails(o)")
          template(#actions)
            BaseButton(
              variant="primary",
              size="sm",
              :loading="approving.has(o.id)",
              @click.stop="onApprove(o)"
            )
              template(#icon-left)
                q-icon(name="check", size="16px")
              | Одобрить
    template(#loading)
      .row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")

  OfferDetailsDialog(v-model="detailsOpen", :offer="selectedDetail")
    template(v-if="selected", #actions)
      BaseButton(
        variant="danger",
        :loading="rejecting.has(selected.id)",
        @click="onReject(selected)"
      )
        template(#icon-left)
          q-icon(name="close", size="16px")
        | Отклонить
      BaseButton(
        variant="primary",
        :loading="approving.has(selected.id)",
        @click="onApprove(selected)"
      )
        template(#icon-left)
          q-icon(name="check", size="16px")
        | Одобрить
</template>

<style scoped lang="scss">
.moderation {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
  }
}

@media (max-width: 768px) {
  .moderation {
    padding: var(--p-4, 16px);
  }
}
</style>
