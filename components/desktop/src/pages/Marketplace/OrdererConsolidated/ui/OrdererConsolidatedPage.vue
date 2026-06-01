<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { BaseBadge, EmptyState } from 'src/shared/ui/base';
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
 * Страница — способ отслеживания процесса сбора коллективных заказов, в которых
 * участвует пайщик (сами его заказы живут на «Моих заказах»). Заказы
 * сгруппированы в ПАРТИИ по паре (оферта × КУ): активные копятся к минимальному
 * объёму, принятые поставщиком — уже сформированы. Все партии рендерятся ОДНОЙ
 * И ТОЙ ЖЕ карточкой: шапка (товар + КУ + бейдж этапа), прогресс-бар сбора,
 * свои заказы строками. Отличается только заполнение бара и подпись этапа —
 * никаких разных по вёрстке сущностей.
 *
 * Здесь видны ТОЛЬКО партии до начала выдачи: этап сбора и подготовки поставки
 * (ACTIVE…ACCEPTED_TO_COOP). Как только открыта выдача (READY_TO_RECEIVE и
 * дальше) или заказ отменён — партия уходит с этой страницы: её цель —
 * наблюдать накопление, а не историю. Получение/история — на «Моих заказах».
 *
 * Источник данных — `Queries.Marketplace.ListMyOrders` (видит только заказы
 * пайщика). Коллективные суммы (`group_accumulated_quantity` — накоплено всеми,
 * `group_min_volume` — целевой минимум КУ) приходят с бэкенда. Polling 15s.
 */

const POLL_INTERVAL_MS = 15_000;
const PAGE_SIZE = 200;

const items = ref<MarketplaceOrderView[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Этап партии = минимальный по рангу среди не-отменённых.
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

// Граница «начала выдачи»: заказы с рангом этапа ≥ этого уходят со страницы
// (выдача открыта / получено / возврат), как и отменённые (ранг 99). На ленте
// сбора остаётся только то, что ещё копится или готовится к поставке.
const ISSUANCE_STAGE_RANK = STAGE_RANK.READY_TO_RECEIVE;

interface CollectiveParty {
  key: string;
  /** collecting — копится (ACTIVE); formed — уже принята поставщиком. */
  collecting: boolean;
  offer_id: string;
  productName: string;
  pvzName: string;
  unitLabel: string;
  orders: MarketplaceOrderView[];
  /** Свой вклад (сумма собственных заказов в этой партии). */
  ownUnits: number;
  ownCost: number;
  /** Накоплено всеми пайщиками (с бэкенда): пул сбора или объём партии. */
  groupAccumulated: number | null;
  /** Целевой минимальный объём поставки на этот КУ. */
  groupMinVolume: number | null;
  stageStatus: MarketplaceOrderStatusView;
}

const parties = computed<CollectiveParty[]>(() => {
  const buckets = new Map<string, CollectiveParty>();
  for (const o of items.value) {
    // Только этап сбора/подготовки — выдача и отменённые сюда не попадают.
    if (STAGE_RANK[o.status] >= ISSUANCE_STAGE_RANK) continue;
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
        collecting,
        offer_id: o.offer_id,
        productName: o.product_name || 'Товар по предложению',
        pvzName: o.delivery_point_name || o.delivery_braname,
        unitLabel: marketplaceUnitShort(o.unit_of_measure),
        orders: [],
        ownUnits: 0,
        ownCost: 0,
        groupAccumulated: o.group_accumulated_quantity ?? null,
        groupMinVolume: o.group_min_volume ?? null,
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
    // Собирающиеся партии выше — по ним идёт активный сбор.
    if (a.collecting !== b.collecting) return a.collecting ? -1 : 1;
    return a.orders[0].created_at < b.orders[0].created_at ? 1 : -1;
  });
});

const hasParties = computed(() => parties.value.length > 0);

// Есть ли целевой объём сбора (иначе — поштучный приём, бар показываем полным).
function hasTarget(p: CollectiveParty): boolean {
  return p.groupMinVolume != null && p.groupMinVolume > 1;
}

function accumulated(p: CollectiveParty): number {
  return p.groupAccumulated ?? p.ownUnits;
}

function reachedMin(p: CollectiveParty): boolean {
  return hasTarget(p) ? accumulated(p) >= (p.groupMinVolume as number) : true;
}

function progressRatio(p: CollectiveParty): number {
  if (!hasTarget(p)) return 1;
  return Math.min(1, accumulated(p) / (p.groupMinVolume as number));
}

function barColor(p: CollectiveParty): string {
  // Идёт сбор и минимум ещё не набран — основной цвет; иначе (набрано или
  // партия уже принята) — успех.
  return p.collecting && !reachedMin(p) ? 'primary' : 'positive';
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
      | Отслеживание сбора коллективных заказов, в которых вы участвуете. Партия
      | копится по предложению и кооперативному участку до минимального объёма
      | поставки; на любой стадии видно, сколько уже набрано всеми пайщиками.

    q-inner-loading(:showing="loading && items.length === 0")
      q-spinner(color="primary", size="2em")

    EmptyState(
      v-if="!loading && !hasParties",
      title="Нет активных сборов",
      body="Здесь видны коллективные заказы на этапе сбора и подготовки поставки. Как только партия уходит в выдачу, она исчезает отсюда — получение смотрите в «Моих заказах»."
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

    .collective__list(v-if="hasParties")
      //- ЕДИНАЯ карточка для любой партии (сбор/принята) — отличается только
      //- заполнением прогресса и бейджем этапа, не вёрсткой.
      .collective__party(v-for="p in parties", :key="p.key")
        .collective__party-head
          .row.items-center.q-gutter-sm.no-wrap
            div.col
              .t-h3 {{ p.productName }}
              .t-muted.collective__party-sub
                q-icon(name="place", size="14px")
                | КУ «{{ p.pvzName }}»
            BaseBadge(:variant="orderStatusDisplay(p.stageStatus).variant") {{ orderStatusDisplay(p.stageStatus).label }}
            span.chip.chip--accent
              q-icon(name="layers", size="14px")
              | {{ p.orders.length }} зак.

        .collective__progress
          .collective__progress-row
            span Накоплено всеми: {{ accumulated(p) }} {{ p.unitLabel }}
            span.t-muted(v-if="hasTarget(p)") цель — от {{ p.groupMinVolume }} {{ p.unitLabel }}
          q-linear-progress.collective__progress-bar(
            :value="progressRatio(p)",
            rounded,
            size="10px",
            :color="barColor(p)",
            track-color="grey-3"
          )
          .t-muted.collective__progress-hint(v-if="p.collecting && reachedMin(p)")
            q-icon(name="check_circle", size="14px", color="positive")
            | Минимальный объём набран — поставщик может принять партию.
          .t-muted.collective__progress-hint(v-else-if="p.collecting")
            | Сбор продолжается. Поставщик может принять партию и раньше — минимум лишь ориентир.
          .t-muted.collective__progress-hint(v-else)
            q-icon(name="local_shipping", size="14px")
            | Партия набрана. Этап: {{ orderStatusDisplay(p.stageStatus).label }}.

        //- Свои заказы в партии — компактными строками (товар/КУ уже в шапке).
        .collective__own-orders
          .collective__own-order(v-for="o in p.orders", :key="o.id")
            span.collective__own-order-who Ваш заказ № {{ o.id.slice(0, 8) }}
            span.collective__own-order-qty {{ o.quantity }} {{ p.unitLabel }}
            span.collective__own-order-cost {{ formatCost(parseFloat(o.total_cost) || 0) }}

        .collective__own
          span.t-muted Ваш вклад в партию
          span.collective__own-val {{ formatCost(p.ownCost) }} · {{ p.ownUnits }} {{ p.unitLabel }}
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

  &__own-orders {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
  }

  &__own-order {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--p-4, 16px);
    align-items: center;
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-top: 1px solid var(--p-line);

    &:first-child {
      border-top: none;
    }
  }

  &__own-order-who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__own-order-qty {
    color: var(--p-ink-2);
  }

  &__own-order-cost {
    font-variant-numeric: tabular-nums;
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
}

@media (max-width: 768px) {
  .collective {
    padding: 0 var(--p-3, 12px) var(--p-4, 16px);
  }
}
</style>
