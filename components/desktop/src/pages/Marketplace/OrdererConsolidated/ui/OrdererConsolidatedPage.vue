<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Notify } from 'quasar';
import {
  OrderCard,
  type Order as OrderCardModel,
  type OrderStatus as OrderCardStatus,
} from 'src/widgets/Marketplace/OrderCard';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchMyOrders } from '../../MyOrders/api';
import type {
  MarketplaceOrderCycleTypeView,
  MarketplaceOrderStatusView,
  MarketplaceOrderView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.4: orderer-стол «Сводный заказ».
 *
 * В циклах `time_based` / `volume_based` / `open_subscription` Order'ы
 * заказчика группируются в партию по `cycle_id`. Эта страница даёт пайщику
 * единый обзор: какие у него партии в полёте, сколько заказов в каждой,
 * суммарная стоимость, общий этап партии. Канон — `widgets/Marketplace/OrderCard`
 * для отдельных заказов внутри партии; страница на MONO Platform v2.
 *
 * Источник данных — `Queries.Marketplace.ListMyOrders` (reuse MyOrders/api).
 * Polling 15s, до Subscriptions Story 9.x.
 */

const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 200;

const items = ref<MarketplaceOrderView[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const CYCLE_TYPE_LABEL: Record<MarketplaceOrderCycleTypeView, string> = {
  TIME_BASED: 'По времени',
  VOLUME_BASED: 'По объёму',
  OPEN_SUBSCRIPTION: 'Открытая подписка',
  INDIVIDUAL: 'Индивидуальный',
};

const CYCLE_TYPE_HINT: Record<MarketplaceOrderCycleTypeView, string> = {
  TIME_BASED: 'Партия закрывается по таймеру; заказы внутри окна объединяются для одной поставки.',
  VOLUME_BASED: 'Партия закрывается при достижении порога объёма заказов.',
  OPEN_SUBSCRIPTION: 'Открытый пул заказов; партии формируются по решению поставщика.',
  INDIVIDUAL: 'Каждый заказ обслуживается поставщиком отдельно.',
};

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
  EXPIRED_NO_THRESHOLD: 'Цикл закрыт без порога',
  EXPIRED_NO_VOLUME: 'Цикл закрыт без объёма',
};

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

// Этап партии = минимальный по STAGE_RANK среди не-отменённых; то есть
// если хотя бы один заказ ещё ждёт цикл, вся партия «Активна».
// Готовый к выдаче переходит в issued только когда все заказы выданы.
const STAGE_RANK: Record<MarketplaceOrderStatusView, number> = {
  ACTIVE: 0,
  ACCEPTED_PENDING_SUPPLIER: 1,
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 1,
  ACCEPTED: 2,
  SUPPLY_PREPARED: 3,
  ACCEPTED_TO_COOP: 4,
  READY_TO_RECEIVE: 5,
  RECEIVED: 6,
  RETURNED: 7,
  CANCELLED_BY_ORDERER: 99,
  CANCELLED_BY_SUPPLIER: 99,
  EXPIRED_NO_THRESHOLD: 99,
  EXPIRED_NO_VOLUME: 99,
};

interface ConsolidatedGroup {
  key: string;
  cycle_id: string | null;
  cycle_type: MarketplaceOrderCycleTypeView;
  offer_id: string;
  supplier_account: string;
  delivery_braname: string;
  orders: MarketplaceOrderView[];
  totalCost: number;
  totalUnits: number;
  stageStatus: MarketplaceOrderStatusView;
}

const groups = computed<ConsolidatedGroup[]>(() => {
  const buckets = new Map<string, ConsolidatedGroup>();
  for (const o of items.value) {
    const key = o.cycle_id
      ? `cycle:${o.cycle_id}`
      : `single:${o.id}`;
    let g = buckets.get(key);
    if (!g) {
      g = {
        key,
        cycle_id: o.cycle_id ?? null,
        cycle_type: o.cycle_type,
        offer_id: o.offer_id,
        supplier_account: o.supplier_account,
        delivery_braname: o.delivery_braname,
        orders: [],
        totalCost: 0,
        totalUnits: 0,
        stageStatus: o.status,
      };
      buckets.set(key, g);
    }
    g.orders.push(o);
    g.totalCost += parseFloat(o.total_cost) || 0;
    g.totalUnits += o.quantity;
    // Этап партии = ранг минимального активного (с приоритетом «в работе»).
    const candidate = STAGE_RANK[o.status];
    const current = STAGE_RANK[g.stageStatus];
    if (candidate < 90 && (current >= 90 || candidate < current)) {
      g.stageStatus = o.status;
    }
  }
  return [...buckets.values()].sort((a, b) => {
    // Группы с cycle_id выше (партии в работе), индивидуальные ниже.
    if (a.cycle_id && !b.cycle_id) return -1;
    if (!a.cycle_id && b.cycle_id) return 1;
    return a.orders[0].created_at < b.orders[0].created_at ? 1 : -1;
  });
});

const hasGroups = computed(() => groups.value.length > 0);
const consolidatedCount = computed(
  () => groups.value.filter((g) => g.cycle_id !== null).length,
);

function formatCost(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

function toCardModel(o: MarketplaceOrderView): OrderCardModel {
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
  };
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOrders({
      page: 1,
      limit: PAGE_SIZE,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    });
    items.value = result.items;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  pollTimer = setInterval(() => {
    void load();
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
q-page.consolidated(role="region", aria-label="Сводный заказ")
  PageHint(storage-key="mp:consolidated:banner-dismissed")
    | Партии заказов, сгруппированные по циклу. Несколько ваших заказов в одной партии обслуживаются совместно — на одном цикле, с одной поставкой.

  .consolidated__toolbar
    q-space
    BaseButton(variant="ghost", iconOnly, ariaLabel="Обновить", :loading="loading", @click="load")
      template(#icon-left)
        q-icon(name="refresh", size="18px")

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!loading && !hasGroups",
    title="У вас ещё нет заказов",
    body="Откройте каталог и оформите первый заказ — он появится здесь."
  )
    template(#icon)
      q-icon(name="inventory_2", size="48px")

  .consolidated__list(v-if="hasGroups")
    .t-muted.consolidated__counter Партий в работе: {{ consolidatedCount }} / Всего групп: {{ groups.length }}

    .consolidated__group(v-for="g in groups", :key="g.key")
      .consolidated__group-head
        .row.items-center.q-gutter-md
          div
            .t-h3
              span(v-if="g.cycle_id") Партия № {{ g.cycle_id }}
              span(v-else) Индивидуальный заказ № {{ g.orders[0].id.slice(0, 8) }}
            .t-muted.consolidated__group-hint {{ CYCLE_TYPE_LABEL[g.cycle_type] }} — {{ CYCLE_TYPE_HINT[g.cycle_type] }}
          q-space
          span.chip.chip--accent
            q-icon(name="layers", size="14px")
            | {{ g.orders.length }} заказа(ов)

        .row.q-col-gutter-md.q-mt-sm
          .col-12.col-md-3
            .t-muted Этап партии
            .consolidated__metric-val {{ STATUS_LABEL[g.stageStatus] }}
          .col-12.col-md-3
            .t-muted Всего единиц
            .consolidated__metric-val {{ g.totalUnits }}
          .col-12.col-md-3
            .t-muted Сумма партии
            .consolidated__metric-val {{ formatCost(g.totalCost) }}
          .col-12.col-md-3
            .t-muted ПВЗ доставки
            .consolidated__metric-val {{ g.delivery_braname }}

      .consolidated__orders
        OrderCard(
          v-for="o in g.orders",
          :key="o.id",
          :order="toCardModel(o)",
          role="orderer"
        )
</template>

<style scoped lang="scss">
.consolidated {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__group {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    overflow: hidden;
  }

  &__group-head {
    padding: var(--p-4, 16px);
  }

  &__group-hint {
    max-width: 640px;
  }

  &__metric-val {
    font-size: var(--p-fs-body);
    color: var(--p-ink-1);
    margin-top: 2px;
  }

  &__orders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--p-4, 16px);
    padding: var(--p-4, 16px);
    border-top: 1px solid var(--p-line);
  }
}

@media (max-width: 768px) {
  .consolidated {
    padding: var(--p-4, 16px);
  }
}
</style>
