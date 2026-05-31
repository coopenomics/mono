<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Dialog, Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OrderCard, toOrderCardModel, type Order as OrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
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
const activeKey = ref('all');

const hasMore = computed(() => currentPage.value < totalPages.value);

// Фильтр по этапу. Покрытие ИСЧЕРПЫВАЮЩЕЕ по enum'у MarketplaceOrderStatusView:
// каждый статус заказа попадает хотя бы в одну вкладку. Иначе заказ молча
// «растекается» — пропадает из всех вкладок, кроме «Все» (баг: молоко в статусе
// SUPPLY_PREPARED не показывалось нигде). Вкладка может покрывать несколько
// статусов: «Ждут поставщика» — сводные и индивидуальные (оба ждут акцепта);
// «Готовятся» — принят → готовится → принят кооперативом (для заказчика это
// единый этап «в работе»); «Отменены» — отмены, истёкшие циклы и возвраты.
const FILTERS: Array<{ key: string; label: string; statuses: MarketplaceOrderStatusView[] | null }> = [
  { key: 'all', label: 'Все', statuses: null },
  { key: 'active', label: 'Активные', statuses: ['ACTIVE'] },
  {
    key: 'pending-supplier',
    label: 'Ждут поставщика',
    statuses: ['ACCEPTED_PENDING_SUPPLIER', 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'],
  },
  {
    key: 'in-progress',
    label: 'В работе',
    statuses: ['ACCEPTED', 'SUPPLY_PREPARED', 'ACCEPTED_TO_COOP'],
  },
  { key: 'ready', label: 'Готовы к выдаче', statuses: ['READY_TO_RECEIVE'] },
  { key: 'received', label: 'Получены', statuses: ['RECEIVED'] },
  {
    key: 'closed',
    label: 'Отменены',
    statuses: [
      'CANCELLED_BY_ORDERER',
      'CANCELLED_BY_SUPPLIER',
      'EXPIRED_NO_THRESHOLD',
      'EXPIRED_NO_VOLUME',
      'RETURNED',
    ],
  },
];

const tabs = computed<PageTab[]>(() => FILTERS.map((f) => ({ key: f.key, label: f.label })));

const activeStatuses = computed<MarketplaceOrderStatusView[] | undefined>(
  () => FILTERS.find((f) => f.key === activeKey.value)?.statuses ?? undefined,
);

// Маппинг доменного заказа в модель карточки — единый `toOrderCardModel`
// (статус-карта + реквизиты товара/ПВЗ) из виджета OrderCard.
const toCardModel = toOrderCardModel;

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOrders({
      statuses: activeStatuses.value,
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
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSelectTab(tab: PageTab): void {
  if (activeKey.value === tab.key) return;
  activeKey.value = tab.key;
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
      SuccessAlert(`Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`);
      await load(1, false);
    } catch (e) {
      FailAlert(e);
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

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template lang="pug">
q-page.orders(role="region", aria-label="Мои заказы")
  PageHint(storage-key="mp:my-orders:banner-dismissed")
    | Заказы, оформленные вами в каталоге. Здесь виден их статус и движение до выдачи на пункте.

  PageTabs.orders__tabs(:tabs="tabs", :active-key="activeKey", @select="onSelectTab")

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

  .row.justify-center.q-my-md(v-if="hasMore")
    BaseButton(variant="ghost", :loading="loading", @click="onLoadMore") Загрузить ещё
</template>

<style scoped lang="scss">
.orders {
  // Меню-вкладки (PageTabs) прижимаются к топбару — гасим верхний отступ
  // страницы; контент ниже разводит flex-gap.
  padding: 0 var(--p-6, 24px) var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // Канон-tabbar тянется во всю ширину; в странице с боковыми отступами
  // убираем его внутренний горизонтальный паддинг, чтобы вкладки шли от края.
  &__tabs {
    margin: 0 calc(-1 * var(--p-6, 24px));
    :deep(.tabbar__tabs) {
      padding: 0 var(--p-6, 24px);
    }
  }

  // Карточки фиксированной ширины (≤360px), выровнены влево — раньше `1fr`
  // растягивал одинокую карточку во всю строку и она «размазывалась».
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 360px));
    justify-content: start;
    gap: var(--p-4, 16px);
  }
}

@media (max-width: 768px) {
  .orders {
    padding: 0 var(--p-4, 16px) var(--p-4, 16px);
  }
}
</style>
