<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { listShipments, type MarketplaceShipmentView } from '../api';

/**
 * Эпик 5 / Story 5.1–5.2: offerer-стол «Подготовка отгрузки».
 *
 * Поставщик видит партии поставки, комплектует и подтверждает готовность к
 * отгрузке. Вёрстка по канону MONO Platform v2: инфо-баннер, canon-таблица
 * со статус-бейджами, скелетон вместо спиннера, EmptyState.
 *
 * Группировка drag-n-drop (ExpeditorGroupingBoard) и печать ТТН
 * (TTNPrintPreview) подключаются второй UI-волной.
 */

const items = ref<MarketplaceShipmentView[]>([]);
const loading = ref(false);

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
    items.value = await listShipments();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить партии');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-supply
  PageHint(storage-key='mp:offerer-supply:banner-dismissed')
    | Партии поставки по принятым заказам. Скомплектуйте партию и подтвердите
    | готовность к отгрузке — после приёмки на ПВЗ она перейдёт кооперативу.

  .offerer-supply__toolbar
    BaseButton(
      variant='ghost',
      icon-only,
      aria-label='Обновить',
      :loading='loading',
      @click='load'
    )
      template(#icon-left)
        q-icon(name='refresh', size='20px')

  TableSkeleton(
    v-if='loading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='880px'
  )
  .table-wrap(v-else-if='items.length')
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
          tr(v-for='row in items', :key='row.id')
            td.col-id {{ row.cycle_id }}
            td {{ row.braname }}
            td.col-variant {{ deliveryVariantLabel(row.delivery_variant) }}
            td.col-status
              BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
            td.col-num {{ row.total_amount }} ₽
            td.col-ttn {{ row.ttn_number || '—' }}

  EmptyState(
    v-else,
    title='Партий пока нет',
    body='Когда вы примете заказ во «Входящих заказах» — здесь появится партия для подготовки к отгрузке.'
  )
    template(#icon)
      q-icon(name='local_shipping', size='48px')
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
}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 880px;
}
.col-id {
  width: 150px;
  font-family: var(--font-mono);
}
.col-variant {
  width: 160px;
}
.col-status {
  width: 200px;
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
