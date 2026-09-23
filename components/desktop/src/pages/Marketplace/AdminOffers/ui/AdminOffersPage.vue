<script lang="ts" setup>
/**
 * Реестр всех предложений кооператива (стол администратора).
 * Backend: marketplaceListAllOffers (Offer:read:all) — все предложения любого
 * статуса (опубликованные/снятые/отклонённые/на модерации), всех поставщиков.
 * Отдельно от «Модерации» (там только то, что прямо сейчас ждёт решения).
 * Клик по строке открывает readonly-карточку предложения; на эти же карточки
 * ведёт переход «Открыть предложение» из реестра заказов.
 */
import { onMounted, ref } from 'vue';
import { uiLocale, t } from 'src/shared/i18n';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { MarketplaceSaleForm, marketplaceQuantityLabel } from 'src/shared/lib/consts/marketplace-units';
import { applyMembershipFee, getMembershipFeePercent, marketplacePackageStockLabel } from 'src/shared/lib/marketplace';
import { useSystemStore } from 'src/entities/System/model';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseBadge, BaseTable, EmptyState, TablePager } from 'src/shared/ui/base';
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { PageHint, StatusFilterButton } from 'src/shared/ui/domain';
import { useHeaderActions } from 'src/shared/hooks';
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { fetchAllOffers } from '../api';
import type { AdminOfferView, AdminOfferStatusView } from '../types';

const { info } = useSystemStore();
const { registerAction } = useHeaderActions();
const { fioCache, enrichFio } = useFioCache();
const offerOverlay = useQueryOverlay('offer');

const items = ref<AdminOfferView[]>([]);
const loading = ref(false);
const statusFilter = ref<AdminOfferStatusView[]>([]);
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 });
// Полная цена для всех, кроме поставщика — с членским взносом.
const feePercent = ref(0);

const OFFER_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  PENDING_MODERATION: { label: t('marketplace.offer.status.pending'), variant: 'warn' },
  ACTIVE: { label: t('marketplace.offer.status.published'), variant: 'pos' },
  REJECTED: { label: t('marketplace.offer.status.rejected'), variant: 'neg' },
  WITHDRAWN: { label: t('marketplace.offer.status.unpublished'), variant: 'neutral' },
};
/** Пункты меню фильтра — в порядке жизненного цикла предложения. */
const STATUS_FILTERS = (Object.keys(OFFER_STATUS) as AdminOfferStatusView[]).map((s) => ({
  key: s,
  label: OFFER_STATUS[s]?.label ?? s,
  statuses: [s],
}));

function statusLabel(s: string): string {
  return OFFER_STATUS[s]?.label ?? s;
}
function statusVariant(s: string): BaseBadgeVariant {
  return OFFER_STATUS[s]?.variant ?? 'neutral';
}

// Сортировки в колонках нет: страница реестра серверная, и щелчок по
// заголовку отсортировал бы только текущие пятьдесят строк, притворившись
// сортировкой всего реестра. «Гарантийный срок возврата» ужат до «Гарантии» —
// полным именем он раздувал колонку вдвое против своего содержимого.
const columns: BaseTableColumn<AdminOfferView>[] = [
  { key: 'status', label: t('marketplace.offers.column.status'), width: '170px' },
  { key: 'offer', label: t('marketplace.offers.column.offer'), width: '130px' },
  { key: 'product', label: t('marketplace.offers.column.product'), width: '220px' },
  { key: 'supplier', label: t('marketplace.offers.column.supplier'), width: '190px' },
  { key: 'price', label: t('marketplace.offers.column.price'), width: '120px', numeric: true },
  { key: 'available', label: t('marketplace.offers.column.available'), width: '150px', numeric: true },
  { key: 'shelf_life', label: t('marketplace.offers.column.shelfLife'), width: '130px', numeric: true },
  { key: 'warranty', label: t('marketplace.offers.column.warranty'), width: '130px', numeric: true },
  { key: 'created', label: t('marketplace.offers.column.createdAt'), width: '150px', nowrap: true },
];

function onStatusFilterUpdate(value: string[]): void {
  statusFilter.value = value as AdminOfferStatusView[];
  void reload();
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}
function formatPrice(v: string | null | undefined): string {
  if (!v) return '—';
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  const withFee = feePercent.value > 0 ? applyMembershipFee(n, feePercent.value) : n;
  return formatAsset2Digits(String(withFee));
}
function availableLabel(o: AdminOfferView): string {
  if (o.unlimited_flag) return t('marketplace.offers.noLimitLabel');
  // Остаток при отпуске упаковкой — по упаковкам.
  if (o.sale_form === MarketplaceSaleForm.PACKAGED && o.packages.length) {
    return marketplacePackageStockLabel(o.packages, o.unit_of_measure);
  }
  return marketplaceQuantityLabel(o.quantity_available, o.unit_of_measure);
}
function formatWarranty(days: number | null | undefined): string {
  return days && days > 0 ? t('marketplace.offers.daysSuffix', { days }) : t('marketplace.offers.noWarrantyLabel');
}
function formatShelfLife(days: number | null | undefined): string {
  return days && days > 0 ? t('marketplace.offers.daysSuffix', { days }) : t('marketplace.offers.noShelfLifeLabel');
}
function supplierTitle(o: AdminOfferView): string {
  return fioCache.value.get(o.supplier_account) || o.supplier_account || '—';
}
function formatDate(d: unknown): string {
  if (d === null || d === undefined) return '—';
  const parsed = new Date(String(d));
  return Number.isNaN(parsed.getTime())
    ? String(d)
    : parsed.toLocaleString(uiLocale(), {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

// Предложение открывается оверлеем поверх реестра: страница пагинации и
// фильтр статусов остаются на месте, полная страница — по кнопке в оверлее.
function goToOffer(o: AdminOfferView): void {
  if (!o.id) return;
  offerOverlay.open(o.id);
}

let lastRequestId = 0;

async function reload(): Promise<void> {
  pagination.value.page = 1;
  await load();
}

async function load(): Promise<void> {
  const myId = ++lastRequestId;
  loading.value = true;
  try {
    const resp = await fetchAllOffers({
      statuses: statusFilter.value.length ? statusFilter.value : undefined,
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    });
    if (myId !== lastRequestId) return;
    items.value = resp.items ?? [];
    pagination.value.rowsNumber = resp.totalCount ?? 0;
    void enrichFio(items.value.map((o) => o.supplier_account));
  } catch (e) {
    if (myId === lastRequestId) FailAlert(e, t('marketplace.offers.loadFailedError'));
  } finally {
    if (myId === lastRequestId) loading.value = false;
  }
}

function goToPage(page: number): void {
  pagination.value = { ...pagination.value, page };
  void load();
}

onMounted(async () => {
  // Фильтр по состоянию — кнопкой в шапке (канон: действия страницы в топбаре).
  registerAction({
    id: 'mp-admin-offers-filter',
    component: StatusFilterButton,
    props: {
      options: STATUS_FILTERS,
      selected: statusFilter,
      onChange: onStatusFilterUpdate,
    },
    order: 1,
  });
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем цену поставщика как есть.
  }
  void load();
});
</script>

<template lang="pug">
q-page.admin-offers(role="region", :aria-label="$t('marketplace.offers.pageAriaLabel')")
  PageHint(storage-key="mp:admin-offers:banner-dismissed")
    | {{ $t('marketplace.offers.pageHint') }}

  BaseTable(
    v-if="loading || items.length",
    :columns="columns",
    :rows="items",
    row-key="id",
    :loading="loading",
    min-width="1390px",
    clickable-rows,
    @row-click="goToOffer"
  )
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusVariant(row.status)") {{ statusLabel(row.status) }}
    template(#cell-offer="{ row }")
      //- Нажатие по идентификатору копирует его и карточку не открывает:
      //- для карточки нажимается вся строка.
      span(@click.stop)
        EntityIdBadge(:rawId="shortId(row.id)", copy-on-click)
    template(#cell-product="{ row }")
      | {{ row.product_name || $t('marketplace.offers.productByOfferAriaLabel') }}
    template(#cell-supplier="{ row }")
      | {{ supplierTitle(row) }}
    template(#cell-price="{ row }")
      | {{ formatPrice(row.price_per_unit) }}
    template(#cell-available="{ row }")
      | {{ row.unlimited_flag ? '∞' : availableLabel(row) }}
    template(#cell-shelf_life="{ row }")
      | {{ formatShelfLife(row.shelf_life_days) }}
    template(#cell-warranty="{ row }")
      | {{ formatWarranty(row.warranty_days) }}
    template(#cell-created="{ row }")
      | {{ formatDate(row.created_at) }}
    template(#footer)
      TablePager(
        :label="$t('marketplace.offers.tableLabel')",
        :page="pagination.page",
        :rows-per-page="pagination.rowsPerPage",
        :rows-number="pagination.rowsNumber",
        @update:page="goToPage"
      )

  EmptyState(
    v-else,
    :title="$t('marketplace.offers.emptyTitle')",
    :body="$t('marketplace.offers.emptyBody')"
  )
    template(#icon)
      q-icon(name="storefront", size="48px")

  OfferRegistryOverlay(
    :coopname="info.coopname",
    moderatable,
    from="offers",
    @moderated="load"
  )
</template>

<style scoped lang="scss">
.admin-offers {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

}

.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}

@media (max-width: 768px) {
  .admin-offers {
    padding: var(--p-4, 16px);
  }
}
</style>
