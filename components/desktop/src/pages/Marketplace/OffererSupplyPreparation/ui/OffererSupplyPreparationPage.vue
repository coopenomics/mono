<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useFirstLoad } from 'src/shared/lib/composables';
import { debounce } from 'quasar';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { BaseBadge, BaseButton, BaseDialog, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { EntityIdBadge } from 'src/shared/ui/EntityIdBadge';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { ShipmentDetailsDrawer } from 'src/widgets/Marketplace/ShipmentDetailsDrawer';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { TTNPrintPreview, type TTNData } from 'src/widgets/Marketplace/TTNPrintPreview';
import { listShipments, type MarketplaceShipmentView } from '../api';
import { fetchSupplierOrders } from '../../OffererIncomingOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import { buildTtnData } from '../lib/ttn';
import CreateShipmentDialog from './CreateShipmentDialog.vue';

/**
 * Эпик 5 / Story 5.1 + Эпик 14 / Story 14.1, 14.5: offerer-стол «Подготовка
 * отгрузки».
 *
 * Два раздела:
 *  1. «К формированию» — принятые (ACCEPTED) заказы, сгруппированные по
 *     заявке→КУ. Поставщик ЯВНО выбирает вариант доставки (самовывоз /
 *     экспедитор+ТТН) и формирует партию (`marketplaceCreateShipment`).
 *     Единый путь для индивидуальных и пакетных заказов (Story 14.1 убрала
 *     навязанный Вариант А для индивидуальных).
 *  2. «Сформированные партии» — уже созданные партии со статусом, колонкой
 *     «Следующий шаг», печатью ТТН (Вариант Б) и QR-передачей на ПВЗ.
 */

const PAGE_SIZE = 200;

const route = useRoute();
const session = useSessionStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

// КУ-детали стола — для человекочитаемой колонки «КУ» (наименование + адрес)
// вместо технического braname; резолвим по braname на фронте (партия несёт
// только braname).
const kuStore = useMarketplaceKUDetailsStore();
const kuByBraname = computed(() => {
  const m = new Map<string, { name: string; address: string }>();
  for (const k of kuStore.details) {
    m.set(k.coreBraname, { name: k.name || k.coreBraname, address: k.addressFull ?? '' });
  }
  return m;
});
function kuName(braname: string): string {
  return kuByBraname.value.get(braname)?.name ?? braname;
}
function kuAddr(braname: string): string {
  return kuByBraname.value.get(braname)?.address ?? '';
}

const shipments = ref<MarketplaceShipmentView[]>([]);
const acceptedOrders = ref<MarketplaceOrderView[]>([]);
// Заказы сформированных партий (статус SUPPLY_PREPARED) — источник состава ТТН.
const preparedOrders = ref<MarketplaceOrderView[]>([]);
// Заказы стола целиком — из них панель партии отбирает её состав по shipment_id.
const shipmentOrders = ref<MarketplaceOrderView[]>([]);
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true);
/** Скелетон — только на первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading);

// Есть ли акцептованные заказы (привязанные к заявке), из которых можно
// сформировать партию — управляет доступностью глобальной кнопки.
const hasFormable = computed(() => acceptedOrders.value.some((o) => o.cycle_id));

// Центр страницы держит placeholder всегда, когда сформированных партий ещё нет
// (как на остальных столах). Текст зависит от того, есть ли уже принятые заказы,
// готовые к формированию: если есть — зовём нажать «Сформировать партию»,
// если нет — отправляем принимать заказы во «Входящих».
const showEmpty = computed(() => !firstLoad.value && shipments.value.length === 0);

const emptyState = computed(() =>
  hasFormable.value
    ? {
        title: 'Партии ещё не сформированы',
        body: 'Принятые заказы готовы к отгрузке. Нажмите «Сформировать партию» в шапке — выберите способ доставки и КУ, и партия появится здесь.',
      }
    : {
        title: 'Партий пока нет',
        body: 'Примите заказы во «Входящих заказах» — затем нажмите «Сформировать партию» в шапке, чтобы собрать отгрузку. Сформированные партии появятся здесь.',
      },
);

// Диалог формирования партии — глобальный, открывается из шапки.
const dialogOpen = ref(false);

// Партия открывается боковой панелью: в таблице видны только цикл, участок и
// сумма, а понять, что и кому едет, по ним нельзя. Код передачи на ПВЗ из
// шапки убран — он живёт отдельным пунктом меню «Отгрузить партию», и здесь
// только мешал главному действию стола (решение владельца 14.09.2026).
const detailsShipment = ref<MarketplaceShipmentView | null>(null);
const detailsOpen = ref(false);

function openDetails(row: MarketplaceShipmentView): void {
  detailsShipment.value = row;
  detailsOpen.value = true;
}

// Печать ТТН — только для Варианта Б (экспедитор), пока партия не принята:
// состав берётся из заказов SUPPLY_PREPARED этой партии.
const ttnDialogOpen = ref(false);
const ttnData = ref<TTNData | null>(null);

/**
 * Накладная есть у всякой партии, которую везёт экспедитор, и нужна она не
 * только до отгрузки: по ней сверяются при приёмке и к ней возвращаются
 * потом. Поэтому смотреть и печатать её можно на любом статусе — состав
 * берётся из заказов партии, которые стол грузит целиком.
 */
function canPrintTtn(row: MarketplaceShipmentView): boolean {
  return isExpeditor(row.delivery_variant);
}

function openTtn(row: MarketplaceShipmentView): void {
  // Поставщик партии = текущий offerer (его собственный стол) → имя из сессии,
  // а не технический account/braname.
  ttnData.value = buildTtnData(
    row,
    preparedOrders.value,
    coopname.value,
    session.displayName,
  );
  ttnDialogOpen.value = true;
}

// Статус партии → метка + canon-вариант бейджа.
const SHIPMENT_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  DRAFT: { label: 'Черновик', variant: 'neutral' },
  SUPPLY_PREPARED: { label: 'Собрана к отгрузке', variant: 'info' },
  RECEPTION_IN_PROGRESS: { label: 'Идёт приёмка', variant: 'warn' },
  ACCEPTED_TO_COOP: { label: 'Принята кооперативом', variant: 'pos' },
  CANCELLED: { label: 'Отменена', variant: 'neutral' },
};

function statusOf(v?: string | null): { label: string; variant: BaseBadgeVariant } {
  if (!v) return { label: '—', variant: 'neutral' };
  return SHIPMENT_STATUS[v] ?? { label: v, variant: 'neutral' };
}

const DELIVERY_VARIANT_LABEL: Record<string, string> = {
  SELF: 'Поставщик сам',
  EXPEDITOR: 'Через экспедитора',
  A: 'Поставщик сам',
  B: 'Через экспедитора',
};

function deliveryVariantLabel(v: string): string {
  return DELIVERY_VARIANT_LABEL[v] ?? v;
}

const isExpeditor = (v?: string | null): boolean => v === 'EXPEDITOR' || v === 'B';

/**
 * Следующий шаг по сформированной партии — что делать дальше. После
 * SUPPLY_PREPARED ход у оператора КУ (открыть акт приёмки); для самовывоза
 * поставщик просто привозит имущество на КУ.
 */
function nextStep(row: MarketplaceShipmentView): string {
  switch (row.status) {
    case 'SUPPLY_PREPARED':
      return isExpeditor(row.delivery_variant)
        ? 'Передайте груз экспедитору по ТТН — оператор КУ примет по накладной'
        : 'Привезите имущество на КУ — оператор откроет приёмку';
    case 'RECEPTION_IN_PROGRESS':
      return 'Идёт приёмка на КУ — дождитесь подписей акта';
    // ACCEPTED_TO_COOP — терминальный: следующего шага нет, подсказка
    // дублировала бы бейдж статуса («Принята кооперативом» дважды).
    default:
      return '';
  }
}

// Ширины подобраны так, чтобы накладная помещалась на экран без прокрутки
// вбок: участок и статус ужаты, «следующий шаг» переехал в панель партии —
// длинной фразой он и раздувал колонку статуса.
const columns: BaseTableColumn<MarketplaceShipmentView>[] = [
  { key: 'cycle', label: 'Партия', width: '130px' },
  { key: 'ku', label: 'Пункт выдачи', width: '210px', sortable: true, field: (row) => kuName(row.braname) },
  { key: 'variant', label: 'Доставка', width: '150px', sortable: true, field: (row) => deliveryVariantLabel(row.delivery_variant) },
  { key: 'status', label: 'Статус', width: '160px', sortable: true, field: 'status' },
  { key: 'amount', label: 'Сумма', width: '130px', numeric: true, sortable: true, field: (row) => Number.parseFloat(row.total_amount) || 0 },
  { key: 'ttn', label: 'Накладная', width: '150px' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [shipmentsResult, ordersResult, shipmentOrdersResult] = await Promise.all([
      listShipments(),
      fetchSupplierOrders({ statuses: ['ACCEPTED'], limit: PAGE_SIZE }),
      // Заказы, попавшие в партии: собранные к отгрузке нужны для ТТН, а
      // принятые кооперативом и выданные — чтобы состав открытой партии не
      // пропадал после приёмки на участке.
      fetchSupplierOrders({ limit: PAGE_SIZE }),
      kuStore.load({ coopname: coopname.value, onlyActive: false }),
    ]);
    shipments.value = shipmentsResult;
    acceptedOrders.value = ordersResult.items;
    shipmentOrders.value = shipmentOrdersResult.items;
    preparedOrders.value = shipmentOrdersResult.items.filter(
      (o) => o.status === 'SUPPLY_PREPARED',
    );
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить партии');
  } finally {
    loading.value = false;
  }
}

function onCreated(): void {
  void load();
}

// Realtime: пока поставщик собирает партию, заказчик может отменить ACCEPTED-
// заказ, а оператор — открыть приёмку уже отгруженной партии. Персональный
// канал поставщика несёт переходы его заказов — список не устаревает.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceOrderStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() },
);

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-supply
  //- Действия страницы — в шапку (канон Teleport): глобальная «Сформировать
  //- партию», код для ПВЗ, обновление.
  Teleport(to="#header-actions-host", defer)
    BaseButton(variant='primary', size='sm', :disabled='!hasFormable', @click='dialogOpen = true')
      template(#icon-left)
        q-icon(name='local_shipping', size='16px')
      | Сформировать партию

  PageHint(storage-key='mp:offerer-supply:banner-dismissed')
    | Нажмите «Сформировать партию» в шапке: выберите способ доставки (самовывоз
    | или экспедитор по накладной), пункт выдачи и перенесите в партию заказы,
    | которые реально грузите. Невыбранное останется принятым и дождётся
    | следующей партии. Нажмите на партию в списке, чтобы увидеть её состав,
    | реквизиты доставки и что делать дальше.

  BaseTable(
    v-if='firstLoad || shipments.length',
    :columns='columns',
    :rows='shipments',
    row-key='id',
    :loading='loading',
    min-width='930px',
    sort-by='ku',
    clickable-rows,
    @row-click='openDetails'
  )
    template(#cell-cycle='{ row }')
      EntityIdBadge(
        v-if='row.cycle_id',
        :raw-id='String(row.cycle_id).slice(0, 8)',
        :copy-value='row.cycle_id',
        copy-on-click
      )
      span(v-else) —
    template(#cell-ku='{ row }')
      .offerer-supply__ku-text
        .offerer-supply__ku-name {{ kuName(row.braname) }}
        .offerer-supply__ku-addr(v-if='kuAddr(row.braname)') {{ kuAddr(row.braname) }}
    template(#cell-variant='{ row }')
      | {{ deliveryVariantLabel(row.delivery_variant) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
    template(#cell-amount='{ row }')
      | {{ formatAsset2Digits(row.total_amount) }} ₽
    template(#cell-ttn='{ row }')
      .offerer-supply__ttn-cell(v-if='canPrintTtn(row)')
        span.offerer-supply__ttn-num(v-if='row.ttn_number') {{ row.ttn_number }}
        BaseButton(variant='ghost', size='sm', @click.stop='openTtn(row)')
          template(#icon-left)
            q-icon(name='print', size='16px')
          | Открыть
      span(v-else) —

  //- Placeholder держит центр пустой области (flex-grow), как на других столах.
  .offerer-supply__empty(v-if='showEmpty')
    EmptyState(
      :title='emptyState.title',
      :body='emptyState.body'
    )
      template(#icon)
        q-icon(name='local_shipping', size='48px')

  CreateShipmentDialog(
    v-model='dialogOpen',
    :orders='acceptedOrders',
    @created='onCreated'
  )

  ShipmentDetailsDrawer(
    v-model='detailsOpen',
    :shipment='detailsShipment',
    :orders='shipmentOrders',
    :loading='loading',
    :branch-name='detailsShipment ? kuName(detailsShipment.braname) : ""',
    :branch-address='detailsShipment ? kuAddr(detailsShipment.braname) : ""',
    :status-label='detailsShipment ? statusOf(detailsShipment.status).label : ""',
    :status-variant='detailsShipment ? statusOf(detailsShipment.status).variant : "neutral"',
    :delivery-label='detailsShipment ? deliveryVariantLabel(detailsShipment.delivery_variant) : ""',
    :next-step='detailsShipment ? nextStep(detailsShipment) : ""',
    :can-print-ttn='detailsShipment ? canPrintTtn(detailsShipment) : false',
    @print-ttn='openTtn'
  )

  BaseDialog(v-model='ttnDialogOpen', title='Товарно-транспортная накладная', maximized)
    TTNPrintPreview(v-if='ttnData', :data='ttnData')
</template>

<style scoped lang="scss">
.offerer-supply {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  // Тянем на высоту вьюпорта за вычетом шапки — чтобы placeholder встал в центр.
  min-height: calc(100vh - 64px);

  // Контейнер пустого состояния занимает оставшуюся высоту и центрирует EmptyState.
  &__empty {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
  }

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }


  &__formation {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__cycle {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__cycle-title {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__cycle-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__ku {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__ku-icon {
    color: var(--p-ink-3);
    margin-top: 1px;
    flex-shrink: 0;
  }

  // Строка открывает партию — курсор показывает это до нажатия.

  &__ku-text {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__ku-name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    // break-word, не anywhere: иначе при узкой ячейке «РОМАШКА» сыпется в столбик.
    overflow-wrap: break-word;
  }

  &__ku-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: break-word;
  }

  &__ku-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    flex-shrink: 0;
  }

  &__cycle-foot {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-1, 4px);
  }

  // Подсказка «следующий шаг» под бейджем статуса — мелкая, второстепенная.

  &__ttn-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-1, 4px);
  }

  &__ttn-num {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    // ttn_number — длинный токен без пробелов (ТТН-55DC6F57974C / VOSKHOD-TTN-…);
    // без принудительного переноса хвост после дефиса вылазит за ячейку.
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.3;
  }
}

.table-scroll {
  overflow-x: auto;
}
@media (max-width: 768px) {
  .offerer-supply {
    padding: var(--p-4, 16px);
  }
}
</style>
