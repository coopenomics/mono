<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import {
  OrderCard,
  orderStatusDisplay,
  toOrderCardModel,
} from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatShortFio } from 'src/shared/lib/utils/getNameFromCertificate';
import {
  acceptOrdersBatch,
  declineOrdersBatch,
  fetchSupplierOrders,
  fetchSupplierMinVolumeMap,
} from '../api';
import type {
  MarketplaceOrderStatusView,
  MarketplaceOrderView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.5 + Эпик 15: offerer-стол «Входящие заказы».
 *
 * Поставщик НЕ видит бесконечный список отдельных заявок. Заказы сгруппированы
 * в ПАРТИИ:
 *  - «накопитель» — активные (ACTIVE) заказы по одной паре (оферта × КУ) копятся
 *    к минимальному объёму поставки (min_supply_volume этого КУ). min — это
 *    ЦЕЛЬ сбора, не порог: партию можно принять и меньшего объёма в любой
 *    момент. Поставщик принимает партию целиком одной кнопкой (backend
 *    оборачивает заказы в одну партию-накопитель и акцептует on-chain).
 *  - «сформированная» — уже принятые заказы, сгруппированные по cycle_id.
 *    Дальше — на странице «Подготовка отгрузки».
 *
 * Polling 15s до Subscriptions Story 9.x. Вёрстка по канону MONO Platform v2.
 */

const PAGE_SIZE = 200;
const POLL_INTERVAL_MS = 15_000;
const SKELETON_COUNT = 4;

const router = useRouter();
const route = useRoute();

const items = ref<MarketplaceOrderView[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const activeKey = ref('pending-accept');
// Карта min-объёма поставки на КУ: `${offer_id}::${braname}` → min_supply_volume.
const minVolumeMap = ref<Map<string, number>>(new Map());
let pollTimer: ReturnType<typeof setInterval> | null = null;

const hasMore = computed(() => currentPage.value < totalPages.value);
const showSkeleton = computed(() => loading.value && items.value.length === 0);

// Фильтр по этапу. «Ждут акцепта» = ACTIVE (заказ создан пайщиком, ждёт приёма
// поставщиком к поставке — guard backend требует status==ACTIVE). После приёма
// заказ переходит в ACCEPTED и попадает в партию (cycle_id). READY_TO_RECEIVE
// для поставщика — продолжение «у кооператива»; EXPIRED_*/RETURNED — терминальные.
const FILTERS: Array<{ key: string; label: string; statuses: MarketplaceOrderStatusView[] | null }> = [
  { key: 'pending-accept', label: 'Ждут акцепта', statuses: ['ACTIVE'] },
  { key: 'accepted', label: 'Приняты', statuses: ['ACCEPTED'] },
  { key: 'supply-prepared', label: 'Поставка готова', statuses: ['SUPPLY_PREPARED'] },
  {
    key: 'accepted-to-coop',
    label: 'У кооператива',
    statuses: ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'],
  },
  { key: 'received', label: 'Получены', statuses: ['RECEIVED'] },
  {
    key: 'closed',
    label: 'Отменены',
    statuses: ['CANCELLED_BY_ORDERER', 'CANCELLED_BY_SUPPLIER', 'RETURNED'],
  },
  { key: 'all', label: 'Все', statuses: null },
];

const tabs = computed<PageTab[]>(() => FILTERS.map((f) => ({ key: f.key, label: f.label })));

const activeStatuses = computed<MarketplaceOrderStatusView[] | undefined>(
  () => FILTERS.find((f) => f.key === activeKey.value)?.statuses ?? undefined,
);

function onSelectTab(tab: PageTab): void {
  if (activeKey.value === tab.key) return;
  activeKey.value = tab.key;
  const query = { ...route.query };
  if (tab.key === 'pending-accept') delete query.status;
  else query.status = tab.key;
  void router.replace({ query });
  void load(1, false);
}

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

interface SupplierParty {
  key: string;
  /** collecting — копится к min (ACTIVE); formed — уже принята (cycle_id). */
  kind: 'collecting' | 'formed';
  cycle_id: string | null;
  offer_id: string;
  productName: string;
  deliveryBraname: string;
  pvzName: string;
  unitLabel: string;
  orders: MarketplaceOrderView[];
  totalUnits: number;
  totalCost: number;
  /** Целевой минимальный объём поставки на этот КУ (для накопителя). */
  minVolume: number | null;
  stageStatus: MarketplaceOrderStatusView;
}

const parties = computed<SupplierParty[]>(() => {
  const buckets = new Map<string, SupplierParty>();
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
        deliveryBraname: o.delivery_braname,
        pvzName: o.delivery_point_name || o.delivery_braname,
        unitLabel: marketplaceUnitShort(o.unit_of_measure),
        orders: [],
        totalUnits: 0,
        totalCost: 0,
        minVolume: collecting
          ? (minVolumeMap.value.get(`${o.offer_id}::${o.delivery_braname}`) ?? null)
          : null,
        stageStatus: o.status,
      };
      buckets.set(key, p);
    }
    p.orders.push(o);
    p.totalUnits += o.quantity;
    p.totalCost += parseFloat(o.total_cost) || 0;
    const candidate = STAGE_RANK[o.status];
    const current = STAGE_RANK[p.stageStatus];
    if (candidate < 90 && (current >= 90 || candidate < current)) {
      p.stageStatus = o.status;
    }
  }
  return [...buckets.values()].sort((a, b) => {
    // Накопители выше — по ним нужно действие.
    if (a.kind !== b.kind) return a.kind === 'collecting' ? -1 : 1;
    return a.orders[0].created_at < b.orders[0].created_at ? 1 : -1;
  });
});

const hasParties = computed(() => parties.value.length > 0);

// Поштучный приём: min ≤ 1 (или не задан) — каждая единица к поставке сразу,
// прогресс-бар не нужен.
function isPerPiece(p: SupplierParty): boolean {
  return p.minVolume == null || p.minVolume <= 1;
}

function progressRatio(p: SupplierParty): number {
  if (!p.minVolume || p.minVolume <= 0) return 1;
  return Math.min(1, p.totalUnits / p.minVolume);
}

function reachedMin(p: SupplierParty): boolean {
  return p.minVolume != null && p.totalUnits >= p.minVolume;
}

function formatCost(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchSupplierOrders({
      statuses: activeStatuses.value,
      page,
      limit: PAGE_SIZE,
    });
    items.value = append ? [...items.value, ...result.items] : result.items;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function loadMore(): void {
  if (hasMore.value && !loading.value) {
    void load(currentPage.value + 1, true);
  }
}

async function onAcceptParty(p: SupplierParty): Promise<void> {
  loading.value = true;
  try {
    // Эпик 15: принять партию целиком одним массивом order_id. min — цель сбора,
    // не порог: принять можно и меньшего объёма (кнопка доступна всегда).
    await acceptOrdersBatch(p.orders.map((o) => o.id));
    SuccessAlert(`Партия принята к поставке (${p.orders.length} зак.)`);
    await load(1, false);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onDeclineParty(p: SupplierParty): void {
  Dialog.create({
    title: 'Отказ от партии',
    message: `Отказ по ${p.orders.length} заказ(ам) на КУ «${p.pvzName}». Укажите причину — она будет показана пайщикам.`,
    prompt: { model: '', type: 'textarea', isValid: (val: string) => val.trim().length > 0 },
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Отказать', color: 'negative', noCaps: true },
    persistent: true,
  }).onOk(async (reason: string) => {
    loading.value = true;
    try {
      await declineOrdersBatch(p.orders.map((o) => o.id), reason.trim());
      NotifyAlert('Заказы партии отклонены');
      await load(1, false);
    } catch (e) {
      FailAlert(e);
    } finally {
      loading.value = false;
    }
  });
}

onMounted(async () => {
  const slug = typeof route.query.status === 'string' ? route.query.status : null;
  const fromUrl = FILTERS.find((f) => f.key === slug);
  if (fromUrl) activeKey.value = fromUrl.key;

  // Карту min-объёмов грузим один раз — она меняется редко (при правке оферты).
  try {
    minVolumeMap.value = await fetchSupplierMinVolumeMap();
  } catch (e) {
    // Прогресс просто деградирует в поштучный режим — не блокируем стол.
    FailAlert(e);
  }

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
q-page.incoming-orders(role='region', aria-label='Входящие заказы поставщика')
  .incoming-orders__col
    PageHint(storage-key='mp:offerer-incoming:banner-dismissed')
      | Заказы пайщиков сгруппированы в партии по кооперативному участку. Партия
      | копится до минимального объёма поставки — это ориентир, а не порог:
      | принять партию можно в любой момент и меньшего объёма. После приёма —
      | «Подготовка отгрузки».

    PageTabs.incoming-orders__tabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')
      template(#actions)
        RefreshButton(:loading='loading', @refresh='load(1, false)')

    //- Скелетон вместо спиннера на первичной загрузке.
    .incoming-orders__skel-list(v-if='showSkeleton')
      .incoming-orders__skel(v-for='n in SKELETON_COUNT', :key='`skel-${n}`')
        .skel.skel--title.incoming-orders__skel-line.incoming-orders__skel-line--head
        .skel.skel--text.incoming-orders__skel-line.incoming-orders__skel-line--title
        .skel.skel--num.incoming-orders__skel-line.incoming-orders__skel-line--meta

    EmptyState(
      v-if='!loading && !hasParties',
      title='Нет партий в этом фильтре',
      body='Когда пайщики оформят заказ на ваше предложение — он появится здесь партией по участку.'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')

    .incoming-orders__list(v-if='hasParties')
      .incoming-orders__party(
        v-for='p in parties',
        :key='p.key',
        :class='`incoming-orders__party--${p.kind}`'
      )
        .incoming-orders__party-head
          .row.items-center.q-gutter-sm.no-wrap
            div.col
              .t-h3 {{ p.productName }}
              .t-muted.incoming-orders__party-sub
                q-icon(name='place', size='14px')
                | КУ «{{ p.pvzName }}»
            span.chip.chip--accent
              q-icon(name='layers', size='14px')
              | {{ p.orders.length }} зак.

        //- НАКОПИТЕЛЬ: прогресс сбора к минимальному объёму + приём партии.
        template(v-if='p.kind === "collecting"')
          .incoming-orders__progress(v-if='!isPerPiece(p)')
            .incoming-orders__progress-row
              span Накоплено: {{ p.totalUnits }} {{ p.unitLabel }}
              span.t-muted цель — от {{ p.minVolume }} {{ p.unitLabel }}
            q-linear-progress.incoming-orders__progress-bar(
              :value='progressRatio(p)',
              rounded,
              size='10px',
              :color='reachedMin(p) ? "positive" : "primary"',
              track-color='grey-3'
            )
            .t-muted.incoming-orders__progress-hint(v-if='reachedMin(p)')
              q-icon(name='check_circle', size='14px', color='positive')
              | Минимальный объём набран — можно принимать партию.
            .t-muted.incoming-orders__progress-hint(v-else)
              | Можно принять и сейчас — минимум лишь ориентир сбора.

          .incoming-orders__progress(v-else)
            .incoming-orders__progress-row
              span К поставке: {{ p.totalUnits }} {{ p.unitLabel }}
            .t-muted.incoming-orders__progress-hint Поштучный приём — каждый заказ можно принять сразу.

          //- Состав партии — кратко, без «бесконечного списка» карточек.
          .incoming-orders__members
            .incoming-orders__member(v-for='o in p.orders', :key='o.id')
              span.incoming-orders__member-who {{ o.orderer_name ? formatShortFio(o.orderer_name) : o.orderer_account }}
              span.incoming-orders__member-qty {{ o.quantity }} {{ p.unitLabel }}
              span.incoming-orders__member-cost {{ formatCost(parseFloat(o.total_cost) || 0) }}

          .incoming-orders__party-foot
            .incoming-orders__party-total
              span.t-muted Итого партии
              span.incoming-orders__party-total-val {{ formatCost(p.totalCost) }} · {{ p.totalUnits }} {{ p.unitLabel }}
            q-space
            BaseButton(variant='ghost', size='sm', @click='onDeclineParty(p)') Отклонить
            BaseButton(variant='primary', size='sm', :loading='loading', @click='onAcceptParty(p)')
              | Принять партию ({{ p.orders.length }})

        //- СФОРМИРОВАННАЯ партия: метрики этапа + readonly карточки заказов.
        template(v-else)
          .row.q-col-gutter-md.incoming-orders__metrics
            .col-6.col-md-3
              .t-muted Этап
              .incoming-orders__metric-val {{ orderStatusDisplay(p.stageStatus).label }}
            .col-6.col-md-3
              .t-muted Всего единиц
              .incoming-orders__metric-val {{ p.totalUnits }} {{ p.unitLabel }}
            .col-6.col-md-3
              .t-muted Сумма партии
              .incoming-orders__metric-val {{ formatCost(p.totalCost) }}
            .col-6.col-md-3
              .t-muted Партия
              .incoming-orders__metric-val
                span(v-if='p.cycle_id') № {{ p.cycle_id }}
                span(v-else) одиночный

          .incoming-orders__cards
            OrderCard(
              v-for='o in p.orders',
              :key='o.id',
              :order='toOrderCardModel(o)',
              role='offerer',
              readonly
            )

      .incoming-orders__more(v-if='hasMore')
        BaseButton(variant='ghost', :loading='loading', @click='loadMore') Показать ещё
</template>

<style scoped lang="scss">
.incoming-orders {
  padding: 0 var(--p-4, 16px) var(--p-6, 24px);

  &__col {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__tabs {
    :deep(.tabbar__tabs) {
      padding: 0;
    }
    :deep(.tabbar__actions) {
      padding-right: 0;
    }
  }

  &__list,
  &__skel-list {
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

  &__members {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
  }

  &__member {
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

  &__member-who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__member-qty {
    color: var(--p-ink-2);
  }

  &__member-cost {
    font-variant-numeric: tabular-nums;
  }

  &__party-foot {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__party-total {
    display: flex;
    flex-direction: column;
  }

  &__party-total-val {
    font-size: var(--p-fs-body);
    color: var(--p-ink-1);
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

  &__skel {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
  }

  &__skel-line {
    margin-top: var(--p-3, 12px);

    &:first-child {
      margin-top: 0;
    }
  }

  &__skel-line--head { width: 50%; }
  &__skel-line--title { width: 80%; }
  &__skel-line--meta { width: 60%; }

  &__more {
    display: flex;
    justify-content: center;
    padding: var(--p-4, 16px) 0;
  }
}
</style>
