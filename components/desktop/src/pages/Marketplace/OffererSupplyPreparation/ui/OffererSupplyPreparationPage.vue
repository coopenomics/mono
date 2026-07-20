<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { BaseBadge, BaseButton, BaseDialog, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { EntityIdBadge } from 'src/shared/ui/EntityIdBadge';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { HandoffCodeDialog } from 'src/widgets/Marketplace/HandoffCode';
import { HandoffTokenKind, useMarketplaceRealtime } from 'src/shared/lib/marketplace';
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
const loading = ref(false);

// Есть ли акцептованные заказы (привязанные к заявке), из которых можно
// сформировать партию — управляет доступностью глобальной кнопки.
const hasFormable = computed(() => acceptedOrders.value.some((o) => o.cycle_id));

// Центр страницы держит placeholder всегда, когда сформированных партий ещё нет
// (как на остальных столах). Текст зависит от того, есть ли уже принятые заказы,
// готовые к формированию: если есть — зовём нажать «Сформировать партию»,
// если нет — отправляем принимать заказы во «Входящих».
const showEmpty = computed(() => !loading.value && shipments.value.length === 0);

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

// Story 14.3: один account-bound код на весь стол. Поставщик показывает его
// оператору приёмки — тот резолвит аккаунт против ленты своего КУ и принимает
// разом всё привезённое. Тот же код вынесен явным пунктом меню «Отгрузить
// партию»; здесь — быстрый доступ диалогом из шапки (общий HandoffCodeDialog).
const myCodeDialogOpen = ref(false);

// Печать ТТН — только для Варианта Б (экспедитор), пока партия не принята:
// состав берётся из заказов SUPPLY_PREPARED этой партии.
const ttnDialogOpen = ref(false);
const ttnData = ref<TTNData | null>(null);

function canPrintTtn(row: MarketplaceShipmentView): boolean {
  return (
    isExpeditor(row.delivery_variant) &&
    (row.status === 'SUPPLY_PREPARED' || row.status === 'RECEPTION_IN_PROGRESS')
  );
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

// Колонки скелетона повторяют шапку реальной таблицы — каркас не дёргается.
const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Цикл', class: 'col-id', cell: 'badge' },
  { label: 'КУ', cell: 'text' },
  { label: 'Вариант', cell: 'text', cellWidth: '120px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '80px' },
  { label: 'ТТН', cell: 'text', cellWidth: '90px' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [shipmentsResult, ordersResult, preparedResult] = await Promise.all([
      listShipments(),
      fetchSupplierOrders({ statuses: ['ACCEPTED'], limit: PAGE_SIZE }),
      fetchSupplierOrders({ statuses: ['SUPPLY_PREPARED'], limit: PAGE_SIZE }),
      kuStore.load({ coopname: coopname.value, onlyActive: false }),
    ]);
    shipments.value = shipmentsResult;
    acceptedOrders.value = ordersResult.items;
    preparedOrders.value = preparedResult.items;
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
    BaseButton(variant='secondary', size='sm', :disabled='!session.username', @click='myCodeDialogOpen = true')
      template(#icon-left)
        q-icon(name='qr_code_2', size='16px')
      | Мой код для ПВЗ

  PageHint(storage-key='mp:offerer-supply:banner-dismissed')
    | Нажмите «Сформировать партию» в шапке: выберите способ доставки (самовывоз
    | или экспедитор по ТТН), кооперативный участок и перенесите в партию заказы,
    | которые реально грузите. Невыбранное останется акцептованным для следующей
    | партии. Сформированные партии и их следующий шаг — ниже.

  TableSkeleton(
    v-if='loading && !shipments.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width="1040px"
  )

  //- Сформированные партии — основной список стола.
  template(v-if='shipments.length')
    .offerer-supply__section-title Сформированные партии
    .table-wrap
      .table-scroll
        table.table
          thead
            tr
              th.col-id Цикл
              th КУ
              th.col-variant Вариант
              th.col-status Статус
              th.col-num Сумма
              th.col-ttn ТТН
          tbody
            tr(v-for='row in shipments', :key='row.id')
              td.col-id
                EntityIdBadge(
                  v-if='row.cycle_id',
                  :raw-id='String(row.cycle_id).slice(0, 8)',
                  :copy-value='row.cycle_id',
                  copy-on-click
                )
                span(v-else) —
              td
                .offerer-supply__ku-text
                  .offerer-supply__ku-name {{ kuName(row.braname) }}
                  .offerer-supply__ku-addr(v-if='kuAddr(row.braname)') {{ kuAddr(row.braname) }}
              td.col-variant {{ deliveryVariantLabel(row.delivery_variant) }}
              td.col-status
                BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
                .offerer-supply__next(v-if='nextStep(row)') {{ nextStep(row) }}
              td.col-num {{ formatAsset2Digits(row.total_amount) }} ₽
              td.col-ttn
                .offerer-supply__ttn-cell(v-if='canPrintTtn(row)')
                  span.offerer-supply__ttn-num(v-if='row.ttn_number') {{ row.ttn_number }}
                  BaseButton(variant='ghost', size='sm', @click='openTtn(row)')
                    template(#icon-left)
                      q-icon(name='print', size='16px')
                    | ТТН
                span(v-else) {{ row.ttn_number || '—' }}

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

  HandoffCodeDialog(v-model='myCodeDialogOpen', :coopname='coopname', :kind='HandoffTokenKind.Pickup')

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

  &__section-title {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    margin-top: var(--p-2, 8px);
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

  &__ku-text {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__ku-name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__ku-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
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
  &__next {
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.3;
    color: var(--p-ink-3);
  }

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
.table {
  table-layout: fixed;
  min-width: 1040px;
}
.col-id {
  width: 150px;
  font-family: var(--font-mono);
}
.col-variant {
  width: 160px;
}
.col-status {
  width: 280px;
}
.col-num {
  width: 120px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.col-ttn {
  width: 150px;
}

@media (max-width: 768px) {
  .offerer-supply {
    padding: var(--p-4, 16px);
  }
}
</style>
