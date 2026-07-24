<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, debounce } from 'quasar';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { SupplyPartyCard } from 'src/widgets/Marketplace/SupplyPartyCard';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
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
 * Live-обновления — realtime: заказ сменил статус (новый заказ накопителя
 * принят, отменён заказчиком и т.п.) → персональный ws-сигнал поставщику, и
 * партии тихо перечитываются. Поллинга нет; страховка — 60-сек resync канала и
 * catch-up на возврат вкладки. Вёрстка по канону MONO Platform v2.
 */

const PAGE_SIZE = 200;
const SKELETON_COUNT = 4;

const router = useRouter();
const route = useRoute();

const items = ref<MarketplaceOrderView[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const activeKey = ref('all');
// Карта min-объёма поставки на КУ: `${offer_id}::${braname}` → min_supply_volume.
const minVolumeMap = ref<Map<string, number>>(new Map());

const hasMore = computed(() => currentPage.value < totalPages.value);
const showSkeleton = computed(() => loading.value && items.value.length === 0);

// Фильтр по этапу. «Все» — дефолт (весь оборот). Остальные табы — фильтры по статусу.
// «Ждут акцепта» = ACTIVE (заказ создан пайщиком, ждёт приёма поставщиком к
// поставке — guard backend требует status==ACTIVE). После приёма заказ
// переходит в ACCEPTED и попадает в партию (cycle_id). READY_TO_RECEIVE для
// поставщика — продолжение «у кооператива»; EXPIRED_*/RETURNED — терминальные.
const FILTERS: Array<{ key: string; label: string; statuses: MarketplaceOrderStatusView[] | null }> = [
  { key: 'all', label: 'Все', statuses: null },
  { key: 'pending-accept', label: 'Ждут акцепта', statuses: ['ACTIVE'] },
  { key: 'accepted', label: 'Приняты', statuses: ['ACCEPTED'] },
  { key: 'supply-prepared', label: 'Собраны к отгрузке', statuses: ['SUPPLY_PREPARED'] },
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
];

const tabs = computed<PageTab[]>(() => FILTERS.map((f) => ({ key: f.key, label: f.label })));

const activeStatuses = computed<MarketplaceOrderStatusView[] | undefined>(
  () => FILTERS.find((f) => f.key === activeKey.value)?.statuses ?? undefined,
);

function onSelectTab(tab: PageTab): void {
  if (activeKey.value === tab.key) return;
  activeKey.value = tab.key;
  const query = { ...route.query };
  if (tab.key === 'all') delete query.status;
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
        unitLabel: marketplaceOrderUnitLabel(o.unit_of_measure),
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

// Есть ли целевой объём сбора (иначе — поштучный приём, бар показываем полным).
function hasTarget(p: SupplierParty): boolean {
  return p.minVolume != null && p.minVolume > 1;
}

function reachedMin(p: SupplierParty): boolean {
  return p.minVolume != null && p.totalUnits >= p.minVolume;
}

function progressRatio(p: SupplierParty): number {
  if (!hasTarget(p)) return 1;
  return Math.min(1, p.totalUnits / (p.minVolume as number));
}

// Идёт сбор и цель ещё не набрана — основной цвет; иначе (набрано / поштучно /
// уже принятая партия) — успех.
function barColor(p: SupplierParty): string {
  return p.kind === 'collecting' && hasTarget(p) && !reachedMin(p) ? 'primary' : 'positive';
}

function formatCost(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

// Состав партии поставщику НЕ показываем: ФИО заказчиков скрыты ради приватности
// (коллективный заказ без фамилий), а без имён строки «объём · сумма» лишь
// дублируют «Итого партии». Поставщику важен агрегат партии, не кто заказал —
// поэтому состав не передаём в SupplyPartyCard вовсе (блок в карточке скрыт).

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
    SuccessAlert('Заказ принят к поставке.');
    await load(1, false);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onDeclineParty(p: SupplierParty): void {
  Dialog.create({
    title: 'Отказ от заказа',
    message: `Отказ от заказа на КУ «${p.pvzName}». Укажите причину — она будет показана пайщикам.`,
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
});

// Заказ сменил статус → персональный ws-сигнал, партии тихо перечитываются.
// Debounce схлопывает пачку переходов (приёмка партии целиком) в одну загрузку.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load(1, false);
}, 400);
useMarketplaceRealtime(
  { MarketplaceOrderStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() }
);
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
      //- ЕДИНАЯ карточка партии (канон-виджет SupplyPartyCard) — та же, что у
      //- заказчика. Действия (Принять/Отклонить) — только пока партия копится.
      SupplyPartyCard(
        v-for='p in parties',
        :key='p.key',
        :product-name='p.productName',
        :pvz-name='p.pvzName',
        :stage-status='p.stageStatus',
        :order-count='p.orders.length',
        hide-order-count,
        :volume-label='`Объём партии: ${p.totalUnits}×${p.unitLabel}`',
        :target-label='hasTarget(p) ? `цель — от ${p.minVolume}×${p.unitLabel}` : ""',
        :progress='progressRatio(p)',
        :bar-color='barColor(p)',
        :members='[]',
        total-label='Итого',
        :total-value='`${formatCost(p.totalCost)} · ${p.totalUnits}×${p.unitLabel}`'
      )
        template(#actions)
          template(v-if='p.kind === "collecting"')
            BaseButton(variant='ghost', @click='onDeclineParty(p)') Отклонить
            BaseButton(variant='primary', :loading='loading', @click='onAcceptParty(p)')
              | Принять заказ

      .incoming-orders__more(v-if='hasMore')
        BaseButton(variant='ghost', :loading='loading', @click='loadMore') Показать ещё
</template>

<style scoped lang="scss">
.incoming-orders {
  // Воздух сверху как на остальных столах поставщика (OffererMyOffers).
  padding: var(--p-6, 24px) var(--p-4, 16px);

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
    gap: var(--p-5, 20px);
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
