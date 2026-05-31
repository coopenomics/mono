<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import {
  OrderCard,
  orderStatusDisplay,
  toOrderCardModel,
} from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { EmptyState } from 'src/shared/ui/base';
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
 * В коллективной закупке (`collective`) Order'ы заказчика группируются в
 * партию по `cycle_id`. Эта страница даёт пайщику
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
  COLLECTIVE: 'Коллективная закупка',
  INDIVIDUAL: 'Индивидуальный',
};

const CYCLE_TYPE_HINT: Record<MarketplaceOrderCycleTypeView, string> = {
  COLLECTIVE:
    'Заказы копятся в общий пул; поставка стартует по достижении целевого объёма либо по решению поставщика.',
  INDIVIDUAL: 'Каждый заказ обслуживается поставщиком отдельно.',
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
    FailAlert(e);
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
  //- Действие страницы — в шапку, где стоят общие действия (канон Teleport).
  Teleport(to="#header-actions-host", defer)
    RefreshButton(:loading="loading", @refresh="load")

  PageHint(storage-key="mp:consolidated:banner-dismissed")
    | Партии заказов, сгруппированные по циклу. Несколько ваших заказов в одной партии обслуживаются совместно — на одном цикле, с одной поставкой.

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
            .consolidated__metric-val {{ orderStatusDisplay(g.stageStatus).label }}
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
          :order="toOrderCardModel(o)",
          role="orderer",
          readonly
        )
</template>

<style scoped lang="scss">
.consolidated {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

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
