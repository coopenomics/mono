<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { fetchCategories } from '../../MarketplaceCatalog/api';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  CatalogOfferCard,
  type CatalogOffer,
} from 'src/widgets/Marketplace/CatalogOfferCard';
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

// Справочник категорий (id → название) — показываем прямо в карточке.
const categoryNames = ref<Record<number, string>>({});

const hasMore = computed(() => items.value.length < total.value);

// Название категории по offer'у (через справочник id → display_name).
function categoryName(offer: MarketplacePendingOfferView): string | null {
  const catId = offer.category_id != null ? Number(offer.category_id) : null;
  return catId != null ? categoryNames.value[catId] ?? null : null;
}

function deliveryPointsSummary(offer: MarketplacePendingOfferView): string {
  const points = offer.delivery_points ?? [];
  return points.map((p) => `${p.braname} (от ${p.min_supply_volume})`).join(', ');
}

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

async function loadCategories(): Promise<void> {
  try {
    const cats = await fetchCategories();
    const map: Record<number, string> = {};
    for (const c of cats) map[Number(c.id)] = c.display_name;
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
    FailAlert(e);
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
      SuccessAlert(`Предложение «${offer.product_name}» одобрено`);
    } catch (e) {
      FailAlert(e);
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
      SuccessAlert(`Предложение «${offer.product_name}» отклонено`);
    } catch (e) {
      FailAlert(e);
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

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        CatalogOfferCard(:offer="toCatalogOffer(o)", :clickable="false")
          //- Полные данные предложения прямо в карточке — модерация без
          //- открытия отдельного диалога.
          template(#details)
            .moderation__meta
              .moderation__meta-row(v-if="categoryName(o)")
                span.moderation__meta-key Категория
                span.moderation__meta-val {{ categoryName(o) }}
              .moderation__meta-row(v-if="o.delivery_points && o.delivery_points.length")
                span.moderation__meta-key Участки поставки
                span.moderation__meta-val {{ deliveryPointsSummary(o) }}
              .moderation__meta-row(v-if="o.warranty_days != null && o.warranty_days > 0")
                span.moderation__meta-key Гарантия
                span.moderation__meta-val {{ o.warranty_days }} дн.
              .moderation__meta-row(v-if="o.supplier_account")
                span.moderation__meta-key Поставщик
                span.moderation__meta-val {{ o.supplier_account }}
          template(#actions)
            BaseButton(
              variant="danger",
              size="sm",
              :loading="rejecting.has(o.id)",
              @click.stop="onReject(o)"
            )
              template(#icon-left)
                q-icon(name="close", size="16px")
              | Отклонить
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

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--p-fs-meta, 12px);
  }

  &__meta-row {
    display: flex;
    gap: var(--p-2, 8px);
  }

  &__meta-key {
    color: var(--p-ink-3);
    min-width: 92px;
    flex-shrink: 0;
  }
}

@media (max-width: 768px) {
  .moderation {
    padding: var(--p-4, 16px);
  }
}
</style>
