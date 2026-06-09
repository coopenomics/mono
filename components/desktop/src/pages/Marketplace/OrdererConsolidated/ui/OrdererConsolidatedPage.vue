<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { SupplyPartyCard } from 'src/widgets/Marketplace/SupplyPartyCard';
import { CardListSkeleton, EmptyState } from 'src/shared/ui/base';
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
 * `group_min_volume` — целевой минимум КУ) приходят с бэкенда. Live-обновления —
 * realtime: заказ в партии сменил статус → персональный ws-сигнал, партии тихо
 * перечитываются. Поллинга нет; страховка — 60-сек resync канала и catch-up на
 * возврат вкладки.
 */

const route = useRoute();
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));

const PAGE_SIZE = 200;

// Клик по карточке партии → карточка предложения (как из корзины). `from=
// consolidated` даёт «назад» подпись «К коллективному заказу» и fallback-маршрут.
function openOffer(offerId: string): void {
  void router.push({
    name: 'marketplace-offer-detail',
    params: { coopname: coopname.value, offerId },
    query: { from: 'consolidated' },
  });
}

const items = ref<MarketplaceOrderView[]>([]);
const loading = ref(false);

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

onMounted(() => {
  void load();
});

// Заказ в партии сменил статус → персональный ws-сигнал, партии тихо
// перечитываются. Debounce схлопывает пачку переходов в одну загрузку.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceOrderStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() }
);
</script>

<template lang="pug">
q-page.collective(role="region", aria-label="Коллективный заказ")
  .collective__col
    PageHint(storage-key="mp:collective:banner-dismissed")
      | Отслеживание коллективных заказов, в которых вы участвуете. Заказы
      | накапливаются по предложению и кооперативному участку до минимального
      | объёма поставки; на каждом этапе видно, сколько уже набрано всеми
      | пайщиками.

    //- Канон загрузки: скелетон, а не спиннер поверх.
    CardListSkeleton(v-if="loading && !hasParties", :count="3")

    EmptyState(
      v-if="!loading && !hasParties",
      title="Активных сборов нет",
      body="Здесь отображаются коллективные заказы на этапе сбора и подготовки поставки. Статус и получение каждого заказа всегда доступны в разделе «Мои заказы»."
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

    .collective__list(v-if="hasParties")
      //- ЕДИНАЯ карточка партии (канон-виджет SupplyPartyCard) — та же, что у
      //- поставщика. Отличаются только данные и тексты, не вёрстка.
      SupplyPartyCard(
        v-for="p in parties",
        :key="p.key",
        clickable,
        @card-click="openOffer(p.offer_id)",
        :product-name="p.productName",
        :pvz-name="p.pvzName",
        :stage-status="p.stageStatus",
        :order-count="p.orders.length",
        hide-order-count,
        :volume-label="`Накоплено: ${accumulated(p)} ${p.unitLabel}`",
        :target-label="hasTarget(p) ? `цель — от ${p.groupMinVolume} ${p.unitLabel}` : ''",
        :progress="progressRatio(p)",
        :bar-color="barColor(p)",
        :members="[]",
        total-label="Ваше участие в партии",
        :total-value="`${formatCost(p.ownCost)} · ${p.ownUnits} ${p.unitLabel}`"
      )
        template(#hint)
          template(v-if="p.collecting && reachedMin(p)")
            q-icon(name="check_circle", size="14px", color="positive")
            span Минимальный объём набран — поставщик может принять партию.
          template(v-else-if="p.collecting")
            span Сбор продолжается. Поставщик может принять партию и раньше — минимум лишь ориентир.
          template(v-else)
            q-icon(name="local_shipping", size="14px")
            span Этап: {{ orderStatusDisplay(p.stageStatus).label }}.
</template>

<style scoped lang="scss">
.collective {
  // Воздух сверху как на столе поставщика — единый канон столов.
  padding: var(--p-6, 24px) var(--p-4, 16px);

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
}

@media (max-width: 768px) {
  .collective {
    padding: var(--p-4, 16px) var(--p-3, 12px);
  }
}
</style>
