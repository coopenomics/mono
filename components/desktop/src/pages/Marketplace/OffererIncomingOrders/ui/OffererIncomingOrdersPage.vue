<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import {
  OrderCard,
  type Order as OrderCardModel,
  type OrderStatus as OrderCardStatus,
} from 'src/widgets/Marketplace/OrderCard';
import { acceptIndividualOrder, declineIndividualOrder, fetchSupplierOrders } from '../api';
import type {
  MarketplaceOrderStatusView,
  MarketplaceOrderView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.5: offerer-стол «Входящие заказы».
 *
 * Поставщик видит заказы, по которым он supplier. Канон `OrderCard` с
 * `role='offerer'`. Polling 15s до Subscriptions Story 9.x.
 *
 * Активные действия (accept/refuse) — в TakeoverDialog'е акцепта партии
 * Эпика 5 (страница `OffererSupplyPreparation`); здесь только read-обзор
 * с фильтром по статусу.
 */

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 15_000;

const items = ref<MarketplaceOrderView[]>([]);
const totalCount = ref(0);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const statusFilter = ref<MarketplaceOrderStatusView | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const hasMore = computed(() => currentPage.value < totalPages.value);

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: MarketplaceOrderStatusView | null }> = [
  { label: 'Все', value: null },
  { label: 'Ждут моего акцепта', value: 'ACCEPTED_PENDING_SUPPLIER' },
  { label: 'Индивидуальные ожидающие', value: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL' },
  { label: 'Приняты', value: 'ACCEPTED' },
  { label: 'Поставка готова', value: 'SUPPLY_PREPARED' },
  { label: 'Приняты кооперативом', value: 'ACCEPTED_TO_COOP' },
  { label: 'Получены', value: 'RECEIVED' },
  { label: 'Отменены', value: 'CANCELLED_BY_ORDERER' },
];

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

const cards = computed<OrderCardModel[]>(() =>
  items.value.map((o) => ({
    id: o.id,
    shortId: o.id.slice(0, 8),
    title: o.offer_id,
    units: o.quantity,
    unitLabel: 'ед.',
    totalCost: parseFloat(o.total_cost) || 0,
    status: STATUS_TO_CARD[o.status],
    createdAt: o.created_at,
    pvz: o.delivery_braname,
  })),
);

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchSupplierOrders({
      statuses: statusFilter.value ? [statusFilter.value] : undefined,
      page,
      limit: PAGE_SIZE,
    });
    items.value = append ? [...items.value, ...result.items] : result.items;
    totalCount.value = result.totalCount;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function changeFilter(value: MarketplaceOrderStatusView | null): void {
  statusFilter.value = value;
  void load(1, false);
}

function loadMore(): void {
  if (hasMore.value && !loading.value) {
    void load(currentPage.value + 1, true);
  }
}

async function onAccept(orderId: string): Promise<void> {
  loading.value = true;
  try {
    await acceptIndividualOrder(orderId);
    Notify.create({ type: 'positive', message: 'Заказ принят', timeout: 4000 });
    await load(1, false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message, timeout: 6000 });
  } finally {
    loading.value = false;
  }
}

function onDecline(orderId: string): void {
  Dialog.create({
    title: 'Отказ от заказа',
    message: 'Укажите причину отказа — она будет показана пайщику в его заказе.',
    prompt: { model: '', type: 'textarea', isValid: (val: string) => val.trim().length > 0 },
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Отказать', color: 'negative', noCaps: true },
    persistent: true,
  }).onOk(async (reason: string) => {
    loading.value = true;
    try {
      await declineIndividualOrder(orderId, reason.trim());
      Notify.create({ type: 'info', message: 'Заказ отклонён', timeout: 4000 });
      await load(1, false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Notify.create({ type: 'negative', message, timeout: 6000 });
    } finally {
      loading.value = false;
    }
  });
}

function onCardAction(payload: { key: string; order: OrderCardModel }): void {
  const orderId = String(payload.order.id);
  if (payload.key === 'accept') {
    void onAccept(orderId);
  } else if (payload.key === 'decline') {
    onDecline(orderId);
  }
}

onMounted(async () => {
  await load(1, false);
  pollTimer = setInterval(() => {
    void load(1, false);
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template lang="pug">
q-page.mp-role-offerer.mp-incoming-orders(role="region", aria-label="Входящие заказы поставщика")
  div.mp-incoming-orders__header
    div
      div.text-h5 Входящие заказы
      div.text-caption.mp-incoming-orders__subtitle
        | Заказы пайщиков, по которым вы выступаете поставщиком. Действия по акцепту партии — на странице «Подготовка отгрузки».
    q-space
    q-btn(flat, dense, round, icon="fa-solid fa-rotate", :loading="loading", @click="load(1, false)", aria-label="Обновить")

  q-tabs.mp-incoming-orders__tabs(
    :model-value="statusFilter",
    inline-label,
    align="left",
    dense,
    no-caps,
    @update:model-value="changeFilter"
  )
    q-tab(
      v-for="opt in STATUS_FILTER_OPTIONS",
      :key="String(opt.value)",
      :name="opt.value",
      :label="opt.label"
    )

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-incoming-orders__empty(v-if="!loading && items.length === 0")
    q-icon(name="fa-solid fa-inbox", size="48px", color="grey-5")
    div.text-subtitle1.q-mt-md Нет заказов в этом фильтре
    div.text-caption Когда пайщики оформят заказ на ваше предложение — он появится здесь.

  div.mp-incoming-orders__grid(v-if="items.length > 0")
    OrderCard(
      v-for="card in cards",
      :key="card.id",
      :order="card",
      role="offerer",
      @action="onCardAction"
    )

  div.mp-incoming-orders__more(v-if="hasMore")
    q-btn(
      flat,
      no-caps,
      :loading="loading",
      label="Показать ещё",
      @click="loadMore"
    )
</template>

<style scoped lang="scss">
.mp-incoming-orders {
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
    max-width: 720px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--mp-space-md);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mp-space-xl) 0;
    color: var(--mp-on-surface-muted);
  }

  &__more {
    display: flex;
    justify-content: center;
    padding: var(--mp-space-md) 0;
  }
}
</style>
