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
 * Поставщик видит партии поставки и понимает следующий шаг по каждой (колонка
 * «Следующий шаг»). Вёрстка по канону MONO Platform v2: инфо-баннер,
 * canon-таблица со статус-бейджами, скелетон вместо спиннера, EmptyState.
 *
 * ВНИМАНИЕ — страница пока read-only (Шаг 1, 2026-05-30). Активная подготовка
 * отгрузки, описанная в Story 5.1 (явный выбор Вариант А/Б, группировка по КУ,
 * форма + печать ТТН), и QR-передача на ПВЗ не реализованы — это доработки
 * Эпика 14 (см. epics.md MVP «Стол заказов»). Сейчас индивидуальные заказы
 * авто-формируют партию Варианта А (самовывоз) на бэкенде без выбора.
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

const isExpeditor = (v?: string | null): boolean => v === 'EXPEDITOR' || v === 'B';

/**
 * Следующий шаг по партии — чтобы поставщик понимал, что делать (страница пока
 * read-only: активная подготовка — выбор варианта, ТТН, QR-передача — в
 * доработках Эпика 14). После SUPPLY_PREPARED ход у оператора КУ (открыть акт
 * приёмки); для самовывоза поставщик просто привозит имущество на КУ.
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
    | Партии поставки по принятым заказам. В колонке «Следующий шаг» — что
    | делать дальше: при самовывозе привезите имущество на КУ (оператор откроет
    | приёмку), при экспедиторе передайте груз по ТТН. После приёмки на ПВЗ
    | партия перейдёт кооперативу.

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
    min-width='960px'
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
              .offerer-supply__next(v-if='nextStep(row)') {{ nextStep(row) }}
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
