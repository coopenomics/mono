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
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { fetchMyOrders } from '../../MyOrders/api';
import type {
  MarketplaceOrderStatusView,
  MarketplaceOrderView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.4: orderer-стол «Коллективный заказ».
 *
 * Зеркало стола поставщика «Входящие заказы», но глазами заказчика и без ФИО
 * других пайщиков. Заказы заказчика сгруппированы в ПАРТИИ:
 *  - «накопитель» — собственные активные (ACTIVE) заказы по паре (оферта × КУ)
 *    копятся к минимальному объёму поставки. Заказчик видит КОЛЛЕКТИВНЫЙ
 *    прогресс сбора (`group_accumulated_quantity` — накоплено всеми пайщиками,
 *    `group_min_volume` — целевой минимум КУ) и свой вклад. Это главное, что
 *    хочет видеть заказчик: насколько собралась его коллективная закупка.
 *  - «сформированная» — уже принятые поставщиком заказы (по cycle_id): метрики
 *    этапа + карточки заказов.
 *
 * Источник данных — `Queries.Marketplace.ListMyOrders` (reuse MyOrders/api),
 * который видит ТОЛЬКО заказы текущего пайщика. Коллективные суммы (`group_*`)
 * приходят с бэкенда уже агрегированными по всем участникам. Polling 15s.
 */

const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 200;

const items = ref<MarketplaceOrderView[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Этап сформированной партии = минимальный по рангу среди не-отменённых.
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

interface OrdererParty {
  key: string;
  /** collecting — копится к min (ACTIVE); formed — уже принята (cycle_id). */
  kind: 'collecting' | 'formed';
  cycle_id: string | null;
  offer_id: string;
  productName: string;
  pvzName: string;
  unitLabel: string;
  orders: MarketplaceOrderView[];
  /** Свой вклад (сумма собственных заказов в этой группе). */
  ownUnits: number;
  ownCost: number;
  /** Накоплено всеми пайщиками на этапе сбора (с бэкенда). */
  groupAccumulated: number | null;
  /** Целевой минимальный объём поставки на этот КУ. */
  groupMinVolume: number | null;
  stageStatus: MarketplaceOrderStatusView;
}

const parties = computed<OrdererParty[]>(() => {
  const buckets = new Map<string, OrdererParty>();
  for (const o of items.value) {
    const collecting = o.status === 'ACTIVE';
    const key = collecting
      ? `collect:${o.offer_id}::${o.delivery_braname}`
      : o.cycle_id
        ? `cycle:${o.cycle_id}`
        : `single:${o.id}`;
    let p = buckets.get(key);
    if (!p) {
      p = {
        key,
        kind: collecting ? 'collecting' : 'formed',
        cycle_id: collecting ? null : (o.cycle_id ?? null),
        offer_id: o.offer_id,
        productName: o.product_name || 'Товар по предложению',
        pvzName: o.delivery_point_name || o.delivery_braname,
        unitLabel: marketplaceUnitShort(o.unit_of_measure),
        orders: [],
        ownUnits: 0,
        ownCost: 0,
        groupAccumulated: collecting ? (o.group_accumulated_quantity ?? null) : null,
        groupMinVolume: collecting ? (o.group_min_volume ?? null) : null,
        stageStatus: o.status,
      };
      buckets.set(key, p);
    }
    p.orders.push(o);
    p.ownUnits += o.quantity;
    p.ownCost += parseFloat(o.total_cost) || 0;
    const candidate = STAGE_RANK[o.status];
    const current = STAGE_RANK[p.stageStatus];
    if (candidate < 90 && (current >= 90 || candidate < current)) {
      p.stageStatus = o.status;
    }
  }
  return [...buckets.values()].sort((a, b) => {
    // Накопители выше — по ним идёт сбор, заказчику важнее прогресс.
    if (a.kind !== b.kind) return a.kind === 'collecting' ? -1 : 1;
    return a.orders[0].created_at < b.orders[0].created_at ? 1 : -1;
  });
});

const hasParties = computed(() => parties.value.length > 0);
const collectingCount = computed(
  () => parties.value.filter((p) => p.kind === 'collecting').length,
);

// Поштучный сбор: min ≤ 1 (или не задан) — прогресс-бар не нужен.
function isPerPiece(p: OrdererParty): boolean {
  return p.groupMinVolume == null || p.groupMinVolume <= 1;
}

function progressRatio(p: OrdererParty): number {
  if (!p.groupMinVolume || p.groupMinVolume <= 0) return 1;
  return Math.min(1, (p.groupAccumulated ?? 0) / p.groupMinVolume);
}

function reachedMin(p: OrdererParty): boolean {
  return (
    p.groupMinVolume != null && (p.groupAccumulated ?? 0) >= p.groupMinVolume
  );
}

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
q-page.collective(role="region", aria-label="Коллективный заказ")
  //- Действие страницы — в шапку, где стоят общие действия (канон Teleport).
  Teleport(to="#header-actions-host", defer)
    RefreshButton(:loading="loading", @refresh="load")

  .collective__col
    PageHint(storage-key="mp:collective:banner-dismissed")
      | Ваши заказы сгруппированы в партии по предложению и кооперативному
      | участку. Пока партия копится — видно, сколько уже набрано всеми
      | пайщиками к минимальному объёму поставки. После приёма поставщиком
      | партия переходит в работу.

    q-inner-loading(:showing="loading && items.length === 0")
      q-spinner(color="primary", size="2em")

    EmptyState(
      v-if="!loading && !hasParties",
      title="У вас ещё нет заказов",
      body="Откройте каталог и оформите первый заказ — он появится здесь."
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

    .collective__list(v-if="hasParties")
      .t-muted.collective__counter Партий в сборе: {{ collectingCount }} / Всего партий: {{ parties.length }}

      .collective__party(
        v-for="p in parties",
        :key="p.key",
        :class="`collective__party--${p.kind}`"
      )
        .collective__party-head
          .row.items-center.q-gutter-sm.no-wrap
            div.col
              .t-h3 {{ p.productName }}
              .t-muted.collective__party-sub
                q-icon(name="place", size="14px")
                | КУ «{{ p.pvzName }}»
            span.chip.chip--accent
              q-icon(name="layers", size="14px")
              | {{ p.orders.length }} зак.

        //- НАКОПИТЕЛЬ: коллективный прогресс сбора к минимальному объёму.
        template(v-if="p.kind === 'collecting'")
          .collective__progress(v-if="!isPerPiece(p)")
            .collective__progress-row
              span Накоплено всеми: {{ p.groupAccumulated ?? 0 }} {{ p.unitLabel }}
              span.t-muted цель — от {{ p.groupMinVolume }} {{ p.unitLabel }}
            q-linear-progress.collective__progress-bar(
              :value="progressRatio(p)",
              rounded,
              size="10px",
              :color="reachedMin(p) ? 'positive' : 'primary'",
              track-color="grey-3"
            )
            .t-muted.collective__progress-hint(v-if="reachedMin(p)")
              q-icon(name="check_circle", size="14px", color="positive")
              | Минимальный объём набран — поставщик может принять партию.
            .t-muted.collective__progress-hint(v-else)
              | Сбор продолжается. Поставщик может принять партию и раньше — минимум лишь ориентир.

          .collective__progress(v-else)
            .collective__progress-row
              span К поставке: {{ p.groupAccumulated ?? p.ownUnits }} {{ p.unitLabel }}
            .t-muted.collective__progress-hint Поштучный сбор — поставщик принимает заказы по мере поступления.

          .collective__own
            span.t-muted Ваш вклад
            span.collective__own-val {{ formatCost(p.ownCost) }} · {{ p.ownUnits }} {{ p.unitLabel }}

          .collective__cards
            OrderCard(
              v-for="o in p.orders",
              :key="o.id",
              :order="toOrderCardModel(o)",
              role="orderer",
              readonly
            )

        //- СФОРМИРОВАННАЯ партия: метрики этапа + карточки заказов.
        template(v-else)
          .row.q-col-gutter-md.collective__metrics
            .col-6.col-md-3
              .t-muted Этап
              .collective__metric-val {{ orderStatusDisplay(p.stageStatus).label }}
            .col-6.col-md-3
              .t-muted Ваших единиц
              .collective__metric-val {{ p.ownUnits }} {{ p.unitLabel }}
            .col-6.col-md-3
              .t-muted Ваша сумма
              .collective__metric-val {{ formatCost(p.ownCost) }}
            .col-6.col-md-3
              .t-muted Партия
              .collective__metric-val
                span(v-if="p.cycle_id") № {{ p.cycle_id }}
                span(v-else) одиночный

          .collective__cards
            OrderCard(
              v-for="o in p.orders",
              :key="o.id",
              :order="toOrderCardModel(o)",
              role="orderer",
              readonly
            )
</template>

<style scoped lang="scss">
.collective {
  padding: 0 var(--p-4, 16px) var(--p-6, 24px);

  &__col {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__party {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__party-sub {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__progress-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--p-fs-body);
  }

  &__progress-bar {
    border-radius: var(--p-r-sm, 8px);
  }

  &__progress-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__own {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__own-val {
    font-size: var(--p-fs-body);
    color: var(--p-ink-1);
    font-variant-numeric: tabular-nums;
  }

  &__metrics {
    margin-top: 0;
  }

  &__metric-val {
    font-size: var(--p-fs-body);
    color: var(--p-ink-1);
    margin-top: 2px;
  }

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--p-3, 12px);
    margin-top: var(--p-2, 8px);
  }
}

@media (max-width: 768px) {
  .collective {
    padding: 0 var(--p-3, 12px) var(--p-4, 16px);
  }
}
</style>
