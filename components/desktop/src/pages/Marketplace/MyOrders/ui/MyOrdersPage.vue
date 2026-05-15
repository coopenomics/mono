<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, Loading, Notify } from 'quasar';
import { OrderCard, type Order as OrderCardModel, type OrderStatus as OrderCardStatus } from 'src/widgets/Marketplace/OrderCard';
import { cancelOrder, fetchMyOrders } from '../api';
import type { MarketplaceOrderStatusView, MarketplaceOrderView } from '../types';

/**
 * Story 4.6: orderer-стол «Мои заказы».
 *
 * Канон — `widgets/Marketplace/OrderCard` (UX-DR9). Корневой класс
 * `mp-role-orderer` подтягивает токены из marketplace-tokens.scss;
 * статус-цвета — внутренний `mp-status-chip` widget'а.
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

function toCardModel(o: MarketplaceOrderView): OrderCardModel & { domainStatus: MarketplaceOrderStatusView } {
  return {
    id: o.id,
    shortId: o.id.slice(0, 8),
    title: o.offer_id,
    units: o.quantity,
    unitLabel: 'ед.',
    totalCost: parseFloat(o.total_cost) || 0,
    status: STATUS_TO_CARD[o.status],
    createdAt: o.created_at,
    pvz: o.delivery_braname,
    domainStatus: o.status,
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

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void load(1, false);
  pollTimer = setInterval(() => {
    if (!loading.value) void load(currentPage.value, false);
  }, POLL_INTERVAL_MS);
});

import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <q-page class="mp-role-orderer mp-my-orders q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5 q-mr-md">Мои заказы</div>
      <q-space />
      <q-btn-toggle
        :model-value="statusFilter"
        :options="STATUS_FILTER_OPTIONS"
        size="sm"
        flat
        no-caps
        toggle-color="primary"
        @update:model-value="changeStatusFilter"
      />
    </div>

    <div v-if="!items.length && !loading" class="mp-my-orders__empty text-center text-grey-7 q-pa-xl">
      У вас пока нет заказов. Перейдите в каталог, чтобы оформить заказ.
    </div>

    <div class="mp-my-orders__grid">
      <OrderCard
        v-for="o in items"
        :key="o.id"
        :order="toCardModel(o)"
        role="orderer"
        @action="onCardAction"
      >
        <template #actions="{ order }">
          <span class="text-caption text-grey-7 q-mr-sm">{{ STATUS_LABEL[(order as any).domainStatus as MarketplaceOrderStatusView] }}</span>
          <q-btn
            v-if="(order as any).domainStatus === 'ACTIVE'"
            flat
            dense
            no-caps
            color="negative"
            label="Отменить"
            @click="onCardAction({ key: 'cancel', order })"
          />
        </template>
      </OrderCard>
    </div>

    <div v-if="hasMore" class="row justify-center q-my-md">
      <q-btn :loading="loading" flat no-caps label="Загрузить ещё" @click="onLoadMore" />
    </div>
  </q-page>
</template>

<style scoped lang="scss">
.mp-my-orders {
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--mp-space-md);
  }

  &__empty { font-size: 15px; }
}
</style>
