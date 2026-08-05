<script lang="ts" setup>
/**
 * Реестр заказов — общая вёрстка для стола администратора (все заказы
 * кооператива) и стола ПВЗ (заказы одного КУ). Различаются только источник
 * данных (какой query дёргает страница) и набор действий (ссылка на
 * предложение — не у всех ролей есть право `Offer:read`); сама таблица и
 * фильтр по статусу — одни и те же, чтобы правка в одном месте чинила оба
 * стола (2026-08-03).
 *
 * Строка открывает заказ отдельной страницей своего стола (2026-08-04):
 * разворот прямо в таблице заменён на полноценную страницу заказа —
 * состояние, документы и операции читаются с одного экрана, на него можно
 * дать ссылку из «Экономики участка» и вернуться назад.
 */
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { BaseBadge, EmptyState } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import {
  ALL_ORDER_REGISTRY_STATUSES,
  type OrderRegistryStatusView,
  type OrderRegistryView,
} from './lib/types';

const props = withDefaults(
  defineProps<{
    items: OrderRegistryView[];
    loading: boolean;
    pagination: { page: number; rowsPerPage: number; rowsNumber: number };
    statusFilter: OrderRegistryStatusView[];
    /** Ссылка «открыть предложение» — скрыта, если у роли нет права Offer:read (стол ПВЗ). */
    showOfferLink?: boolean;
  }>(),
  { showOfferLink: true }
);

const emit = defineEmits<{
  (e: 'update:statusFilter', value: OrderRegistryStatusView[]): void;
  (e: 'request', value: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void;
  (e: 'offer-click', offerId: string): void;
  (e: 'order-click', orderId: string): void;
}>();

const columns = [
  { name: 'status', align: 'left' as const, label: 'Статус', field: 'status' },
  { name: 'order', align: 'left' as const, label: 'Заказ', field: 'id' },
  { name: 'product', align: 'left' as const, label: 'Товар', field: 'product_name' },
  { name: 'orderer', align: 'left' as const, label: 'Заказчик', field: 'orderer_name' },
  { name: 'supplier', align: 'left' as const, label: 'Поставщик', field: 'supplier_name' },
  { name: 'quantity', align: 'right' as const, label: 'Кол-во', field: 'quantity' },
  { name: 'total', align: 'right' as const, label: 'Сумма', field: 'total_cost' },
  { name: 'created', align: 'left' as const, label: 'Создан', field: 'created_at' },
  { name: 'open', align: 'right' as const, label: '', field: 'open', sortable: false },
];

function statusLabel(s: string): string {
  return orderStatusDisplay(s).label;
}
function statusVariant(s: string) {
  return orderStatusDisplay(s).variant;
}

function isStatusActive(s: OrderRegistryStatusView): boolean {
  return props.statusFilter.includes(s);
}
function toggleStatus(s: OrderRegistryStatusView): void {
  emit(
    'update:statusFilter',
    isStatusActive(s) ? props.statusFilter.filter((x) => x !== s) : [...props.statusFilter, s]
  );
}
function resetFilters(): void {
  if (!props.statusFilter.length) return;
  emit('update:statusFilter', []);
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}
function unitLabel(o: OrderRegistryView): string {
  const saleUnit = marketplaceOrderSaleUnit(o.quantity, o.unit_of_measure, o.package_size);
  return `${saleUnit.units} ${saleUnit.unitLabel}`;
}
// requirement b6: реестр показывает сумму, которую реально заплатил пайщик
// (себестоимость + членский взнос, зафиксированный в заказе контрактом) —
// не голую себестоимость товара.
function formatTotalWithFee(o: OrderRegistryView): string {
  return formatAsset2Digits(o.total_cost_with_fee);
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

function ordererTitle(o: OrderRegistryView): string {
  return o.orderer_name || o.orderer_account || '—';
}
function supplierTitle(o: OrderRegistryView): string {
  return o.supplier_name || o.supplier_account || '—';
}

function goToOffer(o: OrderRegistryView): void {
  if (!o.offer_id) return;
  emit('offer-click', o.offer_id);
}

// Строка ведёт на страницу заказа своего стола — маршрут знает страница,
// таблица общая для двух столов и отдаёт только идентификатор.
function openOrder(o: OrderRegistryView): void {
  emit('order-click', o.id);
}

function onRequest(requestProps: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void {
  emit('request', requestProps);
}
</script>

<template lang="pug">
.orders-registry(role="region", aria-label="Реестр заказов")
  .orders-registry__chips(role="group", aria-label="Фильтр по статусу")
    .chip(
      v-for="s in ALL_ORDER_REGISTRY_STATUSES",
      :key="s",
      :class="isStatusActive(s) ? 'chip--accent' : 'chip--neutral'",
      role="button",
      tabindex="0",
      @click="toggleStatus(s)",
      @keydown.enter="toggleStatus(s)"
    ) {{ statusLabel(s) }}
    .chip.chip--reset(
      v-if="props.statusFilter.length",
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
      :rows="props.items",
      :columns="columns",
      row-key="id",
      :loading="props.loading",
      :pagination="props.pagination",
      :rows-per-page-options="[25, 50, 100, 200]",
      no-data-label="Заказы не найдены",
      @request="onRequest"
    )
      template(#body="scope")
        q-tr.orders-registry__row(
          :key="`ord_${scope.row.id}`",
          :props="scope",
          @click="openOrder(scope.row)"
        )
          q-td
            BaseBadge(:variant="statusVariant(scope.row.status)") {{ statusLabel(scope.row.status) }}
          q-td(@click.stop)
            EntityIdBadge(:rawId="shortId(scope.row.id)", copy-on-click)
          q-td
            .row.items-center.no-wrap.q-gutter-xs
              span {{ scope.row.product_name || 'Товар по предложению' }}
              q-icon.cursor-pointer.text-primary(
                v-if="props.showOfferLink && scope.row.offer_id",
                name="open_in_new",
                size="16px",
                @click.stop="goToOffer(scope.row)"
              )
                q-tooltip Открыть предложение
          q-td {{ ordererTitle(scope.row) }}
          q-td {{ supplierTitle(scope.row) }}
          q-td.text-right {{ unitLabel(scope.row) }}
          q-td.text-right.font-monospace {{ formatTotalWithFee(scope.row) }}
          q-td {{ formatDate(scope.row.created_at) }}
          q-td.text-right(auto-width)
            q-icon.orders-registry__open(name="chevron_right", size="20px")
              q-tooltip Открыть заказ

      template(#no-data)
        .orders-registry__nodata
          EmptyState(
            title="Заказов нет",
            body="Заказов по выбранным фильтрам не найдено."
          )
            template(#icon)
              q-icon(name="receipt_long", size="48px")
</template>

<style scoped lang="scss">
.orders-registry {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__nodata {
    width: 100%;
    display: flex;
    justify-content: center;
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

  // Строка открывает страницу заказа — подсветка при наведении и курсор
  // показывают, что она кликабельна.
  :deep(.orders-registry__row) {
    cursor: pointer;
  }

  &__open {
    color: var(--p-ink-3);
  }
}

.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
