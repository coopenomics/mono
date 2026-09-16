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
import { BaseBadge, BaseTable, EmptyState, TablePager } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import type { OrderRegistryView } from './lib/types';

const props = withDefaults(
  defineProps<{
    items: OrderRegistryView[];
    loading: boolean;
    pagination: { page: number; rowsPerPage: number; rowsNumber: number };
    /** Ссылка «открыть предложение» — скрыта, если у роли нет права Offer:read (стол ПВЗ). */
    showOfferLink?: boolean;
  }>(),
  { showOfferLink: true }
);

const emit = defineEmits<{
  (e: 'request', value: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }): void;
  (e: 'offer-click', offerId: string): void;
  (e: 'order-click', orderId: string): void;
}>();

// Сортировки в колонках нет намеренно: страница реестра серверная, и щелчок
// по заголовку отсортировал бы только текущие пятьдесят строк, притворившись
// сортировкой всего реестра.
// Сумма стоит третьей, сразу за состоянием и номером: в хвосте строки она
// уезжала за край и терялась, хотя в реестре это первое, о чём спрашивают.
// Состоянию хватает 150px — подписи в него укладываются, а высвобожденное
// место уходит товару и участникам сделки.
const columns: BaseTableColumn<OrderRegistryView>[] = [
  { key: 'status', label: 'Статус', width: '150px' },
  { key: 'order', label: 'Заказ', width: '110px' },
  { key: 'total', label: 'Сумма', width: '130px', numeric: true },
  { key: 'product', label: 'Товар', width: '220px' },
  { key: 'quantity', label: 'Кол-во', width: '110px', numeric: true },
  { key: 'orderer', label: 'Заказчик', width: '170px' },
  { key: 'supplier', label: 'Поставщик', width: '170px' },
  { key: 'created', label: 'Создан', width: '150px', nowrap: true },
];

function statusLabel(s: string): string {
  return orderStatusDisplay(s).label;
}
function statusVariant(s: string) {
  return orderStatusDisplay(s).variant;
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

// Реестр листается страницами на бэкенде: подвал показывает диапазон и
// переключает страницы, а строки по-прежнему приносит экран.
function goToPage(page: number): void {
  emit('request', {
    pagination: {
      page,
      rowsPerPage: props.pagination.rowsPerPage,
      rowsNumber: props.pagination.rowsNumber,
    },
  });
}
</script>

<template lang="pug">
.orders-registry(role="region", aria-label="Реестр заказов")
  BaseTable(
    v-if="props.loading || props.items.length",
    :columns="columns",
    :rows="props.items",
    row-key="id",
    :loading="props.loading",
    min-width="1210px",
    clickable-rows,
    @row-click="openOrder"
  )
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusVariant(row.status)") {{ statusLabel(row.status) }}
    template(#cell-order="{ row }")
      //- Нажатие по идентификатору копирует его и не открывает заказ: строка
      //- для этого целиком нажимается, а копия часто нужна отдельно.
      span(@click.stop)
        EntityIdBadge(:rawId="shortId(row.id)", copy-on-click)
    template(#cell-product="{ row }")
      .orders-registry__product
        span {{ row.product_name || 'Товар по предложению' }}
        q-icon.orders-registry__offer(
          v-if="props.showOfferLink && row.offer_id",
          name="open_in_new",
          size="16px",
          @click.stop="goToOffer(row)"
        )
          q-tooltip Открыть предложение
    template(#cell-orderer="{ row }")
      | {{ ordererTitle(row) }}
    template(#cell-supplier="{ row }")
      | {{ supplierTitle(row) }}
    template(#cell-quantity="{ row }")
      | {{ unitLabel(row) }}
    template(#cell-total="{ row }")
      | {{ formatTotalWithFee(row) }}
    template(#cell-created="{ row }")
      | {{ formatDate(row.created_at) }}

    template(#footer)
      TablePager(
        label="Заказы",
        :page="props.pagination.page",
        :rows-per-page="props.pagination.rowsPerPage",
        :rows-number="props.pagination.rowsNumber",
        @update:page="goToPage"
      )

  EmptyState(
    v-else,
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

  &__product {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
  }

  // Переход на предложение — отдельная цель внутри строки, поэтому и цвет у
  // него свой: строка целиком открывает заказ.
  &__offer {
    color: var(--p-primary);
    cursor: pointer;
  }

}
</style>
