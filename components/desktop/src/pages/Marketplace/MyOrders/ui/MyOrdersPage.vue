<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Dialog, Loading, Notify } from 'quasar';
import { OrderCard, type Order as OrderCardModel, type OrderStatus as OrderCardStatus } from 'src/widgets/Marketplace/OrderCard';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { cancelOrder, fetchMyOrders } from '../api';
import type { MarketplaceOrderStatusView, MarketplaceOrderView } from '../types';

/**
 * Story 4.6: orderer-стол «Мои заказы».
 *
 * Канон — `widgets/Marketplace/OrderCard` для карточки заказа. Страница на
 * MONO Platform v2: фильтр по статусу — тоггл-чипы `.chip`, действия —
 * `BaseButton`, пустой экран — `EmptyState`.
 *
 * Cancel-кнопка (`@action(key='cancel')`) → confirm-dialog →
 * `marketplaceCancelOrder` (Story 4.4). Live-обновления — polling
 * каждые 10s (Subscription marketplaceOrderUpdated будет в kernel
 * pubsub Story 9.x).
 */

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 10_000;

const items = ref<MarketplaceOrderView[]>([]);
const totalCount = ref(0);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const statusFilter = ref<MarketplaceOrderStatusView | null>(null);

const hasMore = computed(() => currentPage.value < totalPages.value);

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: MarketplaceOrderStatusView | null }> = [
  { label: 'Все', value: null },
  { label: 'Активные', value: 'ACTIVE' },
  { label: 'Ждут поставщика', value: 'ACCEPTED_PENDING_SUPPLIER' },
  { label: 'Приняты', value: 'ACCEPTED' },
  { label: 'Готовы к выдаче', value: 'READY_TO_RECEIVE' },
  { label: 'Получены', value: 'RECEIVED' },
  { label: 'Отменены заказчиком', value: 'CANCELLED_BY_ORDERER' },
  { label: 'Отменены поставщиком', value: 'CANCELLED_BY_SUPPLIER' },
];

const STATUS_LABEL: Record<MarketplaceOrderStatusView, string> = {
  ACTIVE: 'Ждёт цикла / решения',
  ACCEPTED_PENDING_SUPPLIER: 'Ждёт поставщика',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'Ждёт поставщика',
  ACCEPTED: 'Принят поставщиком',
  SUPPLY_PREPARED: 'Поставка готовится',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  READY_TO_RECEIVE: 'Готов к выдаче',
  RECEIVED: 'Получен',
  RETURNED: 'Возвращён',
  CANCELLED_BY_ORDERER: 'Отменён заказчиком',
  CANCELLED_BY_SUPPLIER: 'Отменён поставщиком',
  EXPIRED_NO_THRESHOLD: 'Цикл закрыт без минимального порога',
  EXPIRED_NO_VOLUME: 'Цикл закрыт без объёма',
};

// AC Story 4.6: status → OrderCard статус c цветной точкой (UX-DR20).
// Карточка-канон знает draft/placed/paid/in-delivery/arrived-at-pvz/
// ready-to-issue/issued/cancelled/dispute/returned — мапим бэкенд-домен
// на эти стандартизированные ключи виджета.
const STATUS_TO_CARD: Record<MarketplaceOrderStatusView, OrderCardStatus> = {
  ACTIVE: 'placed',
  ACCEPTED_PENDING_SUPPLIER: 'placed',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'placed',
  ACCEPTED: 'paid',
  SUPPLY_PREPARED: 'in-delivery',
  ACCEPTED_TO_COOP: 'in-delivery',
  READY_TO_RECEIVE: 'ready-to-issue',
  RECEIVED: 'issued',
  RETURNED: 'returned',
  CANCELLED_BY_ORDERER: 'cancelled',
  CANCELLED_BY_SUPPLIER: 'cancelled',
  EXPIRED_NO_THRESHOLD: 'cancelled',
  EXPIRED_NO_VOLUME: 'cancelled',
};

function toCardModel(o: MarketplaceOrderView): OrderCardModel {
  return {
    id: o.id,
    shortId: o.id.slice(0, 8),
    title: o.product_name || 'Товар по предложению',
    units: o.quantity,
    unitLabel: marketplaceUnitShort(o.unit_of_measure),
    totalCost: parseFloat(o.total_cost) || 0,
    status: STATUS_TO_CARD[o.status],
    createdAt: o.created_at,
    pvz: o.delivery_point_address || o.delivery_braname,
  };
}

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOrders({
      statuses: statusFilter.value ? [statusFilter.value] : undefined,
      page,
      limit: PAGE_SIZE,
      sortBy: 'updated_at',
      sortOrder: 'DESC',
    });
    totalCount.value = result.totalCount;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
    items.value = append ? items.value.concat(result.items) : result.items;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function changeStatusFilter(s: MarketplaceOrderStatusView | null): void {
  statusFilter.value = s;
  void load(1, false);
}

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  await load(currentPage.value + 1, true);
}

function confirmCancel(order: MarketplaceOrderView): void {
  Dialog.create({
    title: 'Отменить заказ?',
    message: `Заказ № ${order.id.slice(0, 8)} (${order.quantity} ед., ${order.total_cost} ₽) будет отменён. Средства разблокируются на кошельке Стола заказов.`,
    cancel: { label: 'Не отменять', flat: true },
    ok: { label: 'Отменить заказ', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    Loading.show({ message: 'Отменяю заказ…' });
    try {
      const result = await cancelOrder(order.id);
      Notify.create({
        type: 'positive',
        message: `Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`,
      });
      await load(1, false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message, timeout: 6000 });
    } finally {
      Loading.hide();
    }
  });
}

function onCardAction(payload: { key: string; order: OrderCardModel }): void {
  if (payload.key === 'cancel') {
    const found = items.value.find((o) => o.id === payload.order.id);
    if (found) confirmCancel(found);
  }
  // 'open' → когда будет detail-страница (Story 4.6 follow-up); пока no-op.
}

// Хелперы для slot-scope OrderCard. Доменный статус берём из items по id
// (slot отдаёт OrderCardModel с .id) — полностью типобезопасно, без каста и any.
// В template-выражениях нельзя использовать TS-каст `as`: он валит компиляцию
// render-функции в рантайме (SyntaxError: Unexpected identifier 'as').
function rowDomainStatus(order: OrderCardModel): MarketplaceOrderStatusView | undefined {
  return items.value.find((o) => o.id === order.id)?.status;
}
function rowStatusLabel(order: OrderCardModel): string {
  const status = rowDomainStatus(order);
  return status ? STATUS_LABEL[status] : '';
}
function isOrderCancellable(order: OrderCardModel): boolean {
  return rowDomainStatus(order) === 'ACTIVE';
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void load(1, false);
  pollTimer = setInterval(() => {
    if (!loading.value) void load(currentPage.value, false);
  }, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template lang="pug">
q-page.orders(role="region", aria-label="Мои заказы")
  PageHint(storage-key="mp:my-orders:banner-dismissed")
    | Заказы, оформленные вами в каталоге. Здесь виден их статус и движение до выдачи на пункте.

  .orders__filters(role="tablist", aria-label="Фильтр по статусу")
    .chip.orders__chip(
      v-for="opt in STATUS_FILTER_OPTIONS",
      :key="String(opt.value)",
      :class="statusFilter === opt.value ? 'chip--accent' : 'chip--neutral'",
      role="tab",
      :aria-selected="statusFilter === opt.value",
      tabindex="0",
      @click="changeStatusFilter(opt.value)",
      @keydown.enter="changeStatusFilter(opt.value)"
    ) {{ opt.label }}

  EmptyState(
    v-if="!items.length && !loading",
    title="У вас пока нет заказов",
    body="Перейдите в каталог, чтобы оформить первый заказ."
  )
    template(#icon)
      q-icon(name="shopping_cart", size="48px")

  .orders__grid(v-if="items.length")
    OrderCard(
      v-for="o in items",
      :key="o.id",
      :order="toCardModel(o)",
      role="orderer",
      @action="onCardAction"
    )
      template(#actions="{ order }")
        span.orders__status {{ rowStatusLabel(order) }}
        BaseButton(
          v-if="isOrderCancellable(order)",
          variant="danger",
          size="sm",
          @click="onCardAction({ key: 'cancel', order })"
        ) Отменить

  .row.justify-center.q-my-md(v-if="hasMore")
    BaseButton(variant="ghost", :loading="loading", @click="onLoadMore") Загрузить ещё
</template>

<style scoped lang="scss">
.orders {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__filters {
    display: flex;
    gap: var(--p-2, 8px);
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: var(--p-1, 4px);
  }

  &__chip {
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__status {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm);
    margin-right: var(--p-2, 8px);
  }
}

@media (max-width: 768px) {
  .orders {
    padding: var(--p-4, 16px);
  }
}
</style>
