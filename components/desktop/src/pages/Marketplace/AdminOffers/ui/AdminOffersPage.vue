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
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceQuantityLabel } from 'src/shared/lib/consts/marketplace-units';
import { applyMembershipFee, getMembershipFeePercent } from 'src/shared/lib/marketplace';
import { useSystemStore } from 'src/entities/System/model';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseBadge, BaseButton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { useOfferModeration } from 'src/features/Marketplace/OfferModeration';
import { PageHint } from 'src/shared/ui/domain';
import { fetchAllOffers } from '../api';
import type { AdminOfferView, AdminOfferStatusView } from '../types';

const { info } = useSystemStore();
const router = useRouter();
const { fioCache, enrichFio } = useFioCache();

const items = ref<AdminOfferView[]>([]);
const loading = ref(false);
const statusFilter = ref<AdminOfferStatusView[]>([]);
const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 });
// Полная цена для всех, кроме поставщика — с членским взносом.
const feePercent = ref(0);

const OFFER_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  PENDING_MODERATION: { label: 'На модерации', variant: 'warn' },
  ACTIVE: { label: 'Опубликовано', variant: 'pos' },
  REJECTED: { label: 'Отклонено', variant: 'neg' },
  WITHDRAWN: { label: 'Снято с публикации', variant: 'neutral' },
};
const ALL_STATUSES = Object.keys(OFFER_STATUS) as AdminOfferStatusView[];

function statusLabel(s: string): string {
  return OFFER_STATUS[s]?.label ?? s;
}
function statusVariant(s: string): BaseBadgeVariant {
  return OFFER_STATUS[s]?.variant ?? 'neutral';
}

const columns = [
  { name: 'status', align: 'left' as const, label: 'Статус', field: 'status' },
  { name: 'offer', align: 'left' as const, label: 'Предложение', field: 'id' },
  { name: 'product', align: 'left' as const, label: 'Товар', field: 'product_name' },
  { name: 'supplier', align: 'left' as const, label: 'Поставщик', field: 'supplier_account' },
  { name: 'price', align: 'right' as const, label: 'Цена', field: 'price_per_unit' },
  { name: 'available', align: 'right' as const, label: 'Доступно', field: 'quantity_available' },
  { name: 'shelf_life', align: 'right' as const, label: 'Срок годности', field: 'shelf_life_days' },
  { name: 'warranty', align: 'right' as const, label: 'Гарантийный срок возврата', field: 'warranty_days' },
  { name: 'created', align: 'left' as const, label: 'Создано', field: 'created_at' },
  { name: 'actions', align: 'right' as const, label: '', field: 'id' },
];

function isStatusActive(s: AdminOfferStatusView): boolean {
  return statusFilter.value.includes(s);
}
function toggleStatus(s: AdminOfferStatusView): void {
  statusFilter.value = isStatusActive(s)
    ? statusFilter.value.filter((x) => x !== s)
    : [...statusFilter.value, s];
  void reload();
}
function resetFilters(): void {
  if (!statusFilter.value.length) return;
  statusFilter.value = [];
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
  if (o.unlimited_flag) return 'Без ограничений';
  return marketplaceQuantityLabel(o.quantity_available, o.unit_of_measure, o.order_unit_size);
}
function formatWarranty(days: number | null | undefined): string {
  return days && days > 0 ? `${days} дн.` : 'Без гарантийного срока возврата';
}
function formatShelfLife(days: number | null | undefined): string {
  return days && days > 0 ? `${days} дн.` : 'Без срока годности';
}
function supplierTitle(o: AdminOfferView): string {
  return fioCache.value.get(o.supplier_account) || o.supplier_account || '—';
}
function formatDate(d: unknown): string {
  if (d === null || d === undefined) return '—';
  const parsed = new Date(String(d));
  return Number.isNaN(parsed.getTime())
    ? String(d)
    : parsed.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

// Редактирование гарантийного срока возврата предложения — операция модератора
// (председателя). Срок годности (скоропорт) правит поставщик в своей форме.
const { confirmSetWarranty, isSettingWarranty } = useOfferModeration({
  onWarrantyChanged: () => void load(),
});

function editWarranty(o: AdminOfferView): void {
  if (!o.id) return;
  confirmSetWarranty({ id: o.id, product_name: o.product_name || 'Предложение' }, o.warranty_days ?? 0);
}

function goToOffer(o: AdminOfferView): void {
  if (!o.id) return;
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: info.coopname, offerId: o.id },
    query: { from: 'offers' },
  });
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
    if (myId === lastRequestId) FailAlert(e, 'Не удалось загрузить реестр предложений');
  } finally {
    if (myId === lastRequestId) loading.value = false;
  }
}

function onRequest(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void {
  pagination.value = {
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
    rowsNumber: props.pagination.rowsNumber ?? pagination.value.rowsNumber,
  };
  void load();
}

onMounted(async () => {
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем цену поставщика как есть.
  }
  void load();
});
</script>

<template lang="pug">
q-page.admin-offers(role="region", aria-label="Реестр предложений кооператива")
  PageHint(storage-key="mp:admin-offers:banner-dismissed")
    | Все предложения поставщиков кооператива любого статуса — опубликованные, снятые, отклонённые и ждущие модерации. Нажмите на предложение, чтобы открыть его карточку. Модерация ждущих решения — на отдельной странице.

  .admin-offers__chips(role="group", aria-label="Фильтр по статусу")
    .chip(
      v-for="s in ALL_STATUSES",
      :key="s",
      :class="isStatusActive(s) ? 'chip--accent' : 'chip--neutral'",
      role="button",
      tabindex="0",
      @click="toggleStatus(s)",
      @keydown.enter="toggleStatus(s)"
    ) {{ statusLabel(s) }}
    .chip.chip--reset(
      v-if="statusFilter.length",
      role="button",
      tabindex="0",
      @click="resetFilters",
      @keydown.enter="resetFilters"
    )
      q-icon(name="close", size="14px")
      | Сбросить

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat,
      :rows="items",
      :columns="columns",
      row-key="id",
      :loading="loading",
      :pagination="pagination",
      :rows-per-page-options="[25, 50, 100, 200]",
      no-data-label="Предложения не найдены",
      @request="onRequest",
      @row-click="(_evt, row) => goToOffer(row)"
    )
      template(#body-cell-status="props")
        q-td(:props="props")
          BaseBadge(:variant="statusVariant(props.row.status)") {{ statusLabel(props.row.status) }}
      template(#body-cell-offer="props")
        q-td(:props="props")
          EntityIdBadge(:rawId="shortId(props.row.id)", copy-on-click)
      template(#body-cell-product="props")
        q-td(:props="props") {{ props.row.product_name || 'Товар по предложению' }}
      template(#body-cell-supplier="props")
        q-td(:props="props") {{ supplierTitle(props.row) }}
      template(#body-cell-price="props")
        q-td.text-right.font-monospace(:props="props") {{ formatPrice(props.row.price_per_unit) }}
      template(#body-cell-available="props")
        q-td.text-right(:props="props") {{ props.row.unlimited_flag ? '∞' : availableLabel(props.row) }}
      template(#body-cell-shelf_life="props")
        q-td.text-right(:props="props") {{ formatShelfLife(props.row.shelf_life_days) }}
      template(#body-cell-warranty="props")
        q-td.text-right(:props="props") {{ formatWarranty(props.row.warranty_days) }}
      template(#body-cell-created="props")
        q-td(:props="props") {{ formatDate(props.row.created_at) }}
      template(#body-cell-actions="props")
        q-td.text-right(:props="props", @click.stop)
          .admin-offers__row-actions
            BaseButton(
              variant="secondary",
              size="sm",
              :loading="isSettingWarranty(props.row.id)",
              @click="editWarranty(props.row)"
            )
              template(#icon-left)
                q-icon(name="event_repeat", size="16px")
              | Гарант. срок
            BaseButton(
              variant="secondary",
              size="sm",
              @click="goToOffer(props.row)"
            )
              template(#icon-left)
                q-icon(name="open_in_new", size="16px")
              | Открыть
      template(#no-data)
        .admin-offers__nodata
          EmptyState(
            title="Предложений нет",
            body="Предложений по выбранным фильтрам не найдено."
          )
            template(#icon)
              q-icon(name="storefront", size="48px")
</template>

<style scoped lang="scss">
.admin-offers {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__nodata {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  &__row-actions {
    display: inline-flex;
    gap: var(--p-2, 8px);
    justify-content: flex-end;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);

    .chip {
      cursor: pointer;
      user-select: none;
      height: 28px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  // Строки кликабельны (ведут на карточку) — курсор-указатель как аффорданс.
  :deep(.q-table tbody tr) {
    cursor: pointer;
  }
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
