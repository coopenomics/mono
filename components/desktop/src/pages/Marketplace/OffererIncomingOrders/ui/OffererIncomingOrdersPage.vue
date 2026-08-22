<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Dialog, debounce } from 'quasar';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { SupplyPartyCard } from 'src/widgets/Marketplace/SupplyPartyCard';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { groupAplReceptions, useMarketplaceRealtime, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  listAplReceptionsAsSupplier,
  type MarketplaceAplReceptionView,
} from 'src/entities/MarketplaceAplReception';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
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
import SignAplReceptionDialog from './SignAplReceptionDialog.vue';

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
 * Здесь же поставщик ставит первую подпись на акте приёма-передачи (on-chain
 * `signsupp`) — отдельного экрана «Подпись передачи» больше нет. Партия и есть
 * поставка на всём её пути, и подпись — такое же действие над ней, как «Принять
 * заказ»: держать ради одной кнопки второй список тех же партий значило
 * заставлять поставщика сверять два экрана.
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
const coopname = computed(() => String(route.params.coopname ?? ''));

const items = ref<MarketplaceOrderView[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);
// true до первого onMounted-запроса — иначе на самый первый рендер
// (loading=false, items=[]) успевает попасть EmptyState «Нет партий» перед
// скелетоном, особенно если fetchSupplierMinVolumeMap отвечает не мгновенно
// (жалоба 2026-08-02).
const loading = ref(true);
const activeKey = ref('all');
// Карта min-объёма поставки на КУ: `${offer_id}::${braname}` → min_supply_volume.
const minVolumeMap = ref<Map<string, number>>(new Map());

// Акты приёмки поставщика. Грузятся отдельным запросом и НЕ зависят от вкладки
// и страницы списка заказов — иначе поставка, ждущая подписи, пропадала бы из
// виду вместе с фильтром.
const receptions = ref<MarketplaceAplReceptionView[]>([]);
const signDialog = ref(false);
const signGroup = ref<ReceptionGroup<MarketplaceAplReceptionView> | null>(null);
// Реквизиты КУ нужны диалогу подписи: там поставка называется по-человечески
// («Поставка на Ромашка», адрес), а акт несёт только служебный braname.
const kuStore = useMarketplaceKUDetailsStore();

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
  /** Обложка предложения — одна на всю партию (партия и есть одно предложение). */
  imageUrl: string | null;
  deliveryBraname: string;
  pvzName: string;
  /** Базовая единица (сырое значение) — для пересчёта «Итого» в упаковки (Эпик 18). */
  unitOfMeasure: MarketplaceOrderView['unit_of_measure'];
  /** Содержимое упаковки в базовой единице; null — по мере либо разные упаковки в партии (смешанные не считаем упаковками). */
  packageSize: number | null;
  orders: MarketplaceOrderView[];
  totalUnits: number;
  totalCost: number;
  /** Целевой минимальный объём поставки на этот КУ (для накопителя). */
  minVolume: number | null;
  stageStatus: MarketplaceOrderStatusView;
}

/** Сводная поставка, ждущая подписи, с ключом, уникальным в пределах страницы. */
interface PendingSignEntry {
  key: string;
  group: ReceptionGroup<MarketplaceAplReceptionView>;
}

/**
 * Поставки, ждущие первой подписи поставщика, — по заказам, которые в них вошли.
 *
 * Группируем сначала по циклу поставки: карточка сформированной партии на этой
 * странице и есть цикл, и подписывать надо ровно её акты, а не всё, что приехало
 * на тот же участок. Если оператор принял части цикла по-разному (очно и через
 * экспедитора), групп внутри цикла будет две — тогда и кнопок две, каждая со
 * своим составом; сливать их нельзя, у них разные акты.
 *
 * Индексируем по `order_id`, а не по циклу: заказ у акта и партии общий всегда,
 * а вот партия одиночного заказа собирается без цикла — по циклу она бы кнопку
 * не получила и поставка встала бы намертво.
 */
const pendingSignByOrder = computed(() => {
  const byCycle = new Map<string, MarketplaceAplReceptionView[]>();
  for (const r of receptions.value) {
    if (r.status !== 'PENDING_SUPPLIER_SIGN') continue;
    // Акт без цикла (одиночная поставка) — сам себе группа.
    const cycleKey = r.cycle_id || `reception:${r.id}`;
    const list = byCycle.get(cycleKey);
    if (list) list.push(r);
    else byCycle.set(cycleKey, [r]);
  }
  const byOrder = new Map<string, PendingSignEntry>();
  for (const [cycleKey, list] of byCycle) {
    for (const group of groupAplReceptions(list, { byOfferer: false })) {
      // Ключ группы (участок|способ|статус) повторяется у разных циклов —
      // добавляем цикл, иначе v-for схлопнет две разные поставки в одну.
      const entry: PendingSignEntry = { key: `${cycleKey}|${group.key}`, group };
      for (const r of group.receptions) {
        for (const f of r.fact_quantity_per_order) byOrder.set(f.order_id, entry);
      }
    }
  }
  return byOrder;
});

function pendingSignGroups(p: SupplierParty): PendingSignEntry[] {
  const seen = new Set<PendingSignEntry>();
  for (const o of p.orders) {
    const entry = pendingSignByOrder.value.get(o.id);
    if (entry) seen.add(entry);
  }
  return [...seen];
}

function openSign(group: ReceptionGroup<MarketplaceAplReceptionView>): void {
  signGroup.value = group;
  signDialog.value = true;
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
        imageUrl: o.image_url ?? null,
        deliveryBraname: o.delivery_braname,
        pvzName: o.delivery_point_name || o.delivery_braname,
        unitOfMeasure: o.unit_of_measure,
        packageSize: o.package_size,
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
    // Разные упаковки внутри одной партии (заказчики выбрали разный размер) —
    // «число упаковок» для суммы неоднозначно, откатываемся к базовой единице.
    if (p.packageSize !== o.package_size) p.packageSize = null;
    p.orders.push(o);
    p.totalUnits += o.quantity;
    p.totalCost += parseFloat(o.total_cost) || 0;
    const candidate = STAGE_RANK[o.status];
    const current = STAGE_RANK[p.stageStatus];
    if (candidate < 90 && (current >= 90 || candidate < current)) {
      p.stageStatus = o.status;
    }
  }
  const awaitsSign = (p: SupplierParty): boolean =>
    p.orders.some((o) => pendingSignByOrder.value.has(o.id));
  return [...buckets.values()].sort((a, b) => {
    // Ждущие подписи — в самый верх: поставка уже на ПВЗ и стоит до подписи,
    // это самое срочное действие поставщика.
    const signA = awaitsSign(a);
    const signB = awaitsSign(b);
    if (signA !== signB) return signA ? -1 : 1;
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

// «Итого партии»: число упаковок, как их заказывали (Эпик 18), а не итоговый
// объём в базовой единице — «Объём партии»/«цель» выше нарочно остаются в
// базовой единице (это порог поставки, не зависит от того, как заказчики
// упаковали покупку).
function totalUnitsLabel(p: SupplierParty): string {
  const saleUnit = marketplaceOrderSaleUnit(p.totalUnits, p.unitOfMeasure, p.packageSize);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
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

/**
 * Акты приёмки + реквизиты КУ. Отдельно от заказов и молча: подпись — не
 * основной поток страницы, и её сбой не должен ронять список партий.
 */
async function loadReceptions(): Promise<void> {
  const [list] = await Promise.all([
    listAplReceptionsAsSupplier().catch(() => [] as MarketplaceAplReceptionView[]),
    kuStore.load({ coopname: coopname.value, onlyActive: false }).catch(() => undefined),
  ]);
  receptions.value = list;
}

function onSigned(): void {
  void loadReceptions();
  void load(1, false);
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

  void loadReceptions();
  await load(1, false);
});

// Заказ сменил статус → персональный ws-сигнал, партии тихо перечитываются.
// Debounce схлопывает пачку переходов (приёмка партии целиком) в одну загрузку.
// Приёмка на ПВЗ приходит отдельным сигналом «ждёт вашей подписи» — по нему
// перечитываем акты, чтобы кнопка подписи появилась на карточке без F5.
const reloadLive = debounce(() => {
  void loadReceptions();
  if (loading.value) return;
  void load(1, false);
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    MarketplaceReceptionPendingSignEvent: () => reloadLive(),
  },
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
      | «Подготовка отгрузки». Когда партия принята на пункте выдачи, здесь же
      | на её карточке появится «Подписать передачу»: этой подписью вы
      | подтверждаете факт приёмки, дальше акт уходит на закрывающую подпись
      | оператора участка.

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
      //- Канон-виджет SupplyPartyCard. Действия (Принять/Отклонить) — только
      //- пока партия копится; бар сбора — тоже только пока копится (после
      //- приёма/получения «100%» не несёт информации, только шум — жалоба
      //- 2026-08-02).
      SupplyPartyCard(
        v-for='p in parties',
        :key='p.key',
        :product-name='p.productName',
        :image-url='p.imageUrl',
        :pvz-name='p.pvzName',
        :stage-status='p.stageStatus',
        :order-count='p.orders.length',
        hide-order-count,
        :progress='progressRatio(p)',
        :bar-color='barColor(p)',
        :show-progress='p.kind === "collecting" && hasTarget(p)',
        :members='[]',
        total-label='Итого',
        :total-value='formatCost(p.totalCost)',
        :total-units='totalUnitsLabel(p)'
      )
        template(#actions)
          template(v-if='p.kind === "collecting"')
            BaseButton(variant='ghost', @click='onDeclineParty(p)') Отклонить
            BaseButton(variant='primary', :loading='loading', @click='onAcceptParty(p)')
              | Принять заказ
          //- Партия принята на ПВЗ и ждёт первой подписи поставщика: акт
          //- приёмки найден по cycle_id этой же партии.
          BaseButton(
            v-for='e in pendingSignGroups(p)',
            :key='e.key',
            variant='primary',
            @click='openSign(e.group)'
          )
            template(#icon-left)
              q-icon(name='draw', size='18px')
            | Подписать передачу

      .incoming-orders__more(v-if='hasMore')
        BaseButton(variant='ghost', :loading='loading', @click='loadMore') Показать ещё

  SignAplReceptionDialog(
    v-model='signDialog',
    :group='signGroup',
    @signed='onSigned'
  )
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
