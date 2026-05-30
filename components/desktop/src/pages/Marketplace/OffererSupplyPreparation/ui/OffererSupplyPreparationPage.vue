<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { listShipments, type MarketplaceShipmentView } from '../api';
import { fetchSupplierOrders } from '../../OffererIncomingOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import { groupAcceptedOrders, type ShipmentFormationCycle } from '../lib/shipmentFormation';
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
 *  2. «Сформированные партии» — уже созданные партии со статусом и колонкой
 *     «Следующий шаг».
 *
 * Не реализовано (доработки Эпика 14): печать ТТН (TTNPrintPreview), QR-передача
 * на ПВЗ, express-приёмка без партии.
 */

const PAGE_SIZE = 200;

const shipments = ref<MarketplaceShipmentView[]>([]);
const acceptedOrders = ref<MarketplaceOrderView[]>([]);
const loading = ref(false);

const formationCycles = computed<ShipmentFormationCycle[]>(() =>
  groupAcceptedOrders(acceptedOrders.value),
);

const isEmpty = computed(
  () => !loading.value && formationCycles.value.length === 0 && shipments.value.length === 0,
);

// Диалог формирования партии.
const dialogOpen = ref(false);
const selectedCycle = ref<ShipmentFormationCycle | null>(null);

function openFormation(cycle: ShipmentFormationCycle): void {
  selectedCycle.value = cycle;
  dialogOpen.value = true;
}

// Статус партии → метка + canon-вариант бейджа.
const SHIPMENT_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  DRAFT: { label: 'Черновик', variant: 'neutral' },
  SUPPLY_PREPARED: { label: 'Готова к отгрузке', variant: 'info' },
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
    case 'ACCEPTED_TO_COOP':
      return 'Принято кооперативом';
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
    const [shipmentsResult, ordersResult] = await Promise.all([
      listShipments(),
      fetchSupplierOrders({ statuses: ['ACCEPTED'], limit: PAGE_SIZE }),
    ]);
    shipments.value = shipmentsResult;
    acceptedOrders.value = ordersResult.items;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить партии');
  } finally {
    loading.value = false;
  }
}

function onCreated(): void {
  void load();
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-supply
  PageHint(storage-key='mp:offerer-supply:banner-dismissed')
    | Принятые заказы в разделе «К формированию» — выберите способ доставки
    | (самовывоз или экспедитор по ТТН) и сформируйте партию. Сформированные
    | партии и их следующий шаг — ниже. После приёмки на ПВЗ партия перейдёт
    | кооперативу.

  .offerer-supply__toolbar
    RefreshButton(:loading='loading', @refresh='load')

  TableSkeleton(
    v-if='loading && !shipments.length && !formationCycles.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='960px'
  )

  //- Раздел 1: заявки, ожидающие явного формирования партии.
  template(v-if='formationCycles.length')
    .offerer-supply__section-title К формированию
    .offerer-supply__formation
      .offerer-supply__cycle(v-for='c in formationCycles', :key='c.cycle_id')
        .offerer-supply__cycle-head
          .offerer-supply__cycle-title {{ c.title }}
          .offerer-supply__cycle-meta {{ c.ordersCount }} заказ(ов) · {{ c.sum }} ₽
        .offerer-supply__ku(v-for='g in c.groups', :key='g.braname')
          q-icon.offerer-supply__ku-icon(name='place', size='16px')
          .offerer-supply__ku-text
            .offerer-supply__ku-name {{ g.kuName }}
            .offerer-supply__ku-addr(v-if='g.kuAddress') {{ g.kuAddress }}
          .offerer-supply__ku-meta {{ g.ordersCount }} · {{ g.units }} ед. · {{ g.sum }} ₽
        .offerer-supply__cycle-foot
          BaseButton(variant='primary', size='sm', @click='openFormation(c)')
            template(#icon-left)
              q-icon(name='local_shipping', size='16px')
            | Сформировать партию

  //- Раздел 2: уже сформированные партии.
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
              td.col-id {{ row.cycle_id }}
              td {{ row.braname }}
              td.col-variant {{ deliveryVariantLabel(row.delivery_variant) }}
              td.col-status
                BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
                .offerer-supply__next(v-if='nextStep(row)') {{ nextStep(row) }}
              td.col-num {{ row.total_amount }} ₽
              td.col-ttn {{ row.ttn_number || '—' }}

  EmptyState(
    v-if='isEmpty',
    title='Партий пока нет',
    body='Когда вы примете заказ во «Входящих заказах» — он появится здесь для формирования партии.'
  )
    template(#icon)
      q-icon(name='local_shipping', size='48px')

  CreateShipmentDialog(
    v-model='dialogOpen',
    :cycle='selectedCycle',
    @created='onCreated'
  )
</template>

<style scoped lang="scss">
.offerer-supply {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

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
}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 960px;
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
  width: 120px;
}

@media (max-width: 768px) {
  .offerer-supply {
    padding: var(--p-4, 16px);
  }
}
</style>
