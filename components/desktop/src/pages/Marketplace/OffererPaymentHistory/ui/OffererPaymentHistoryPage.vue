<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { listMyPayments, type MarketplaceOutgoingPaymentRequestView } from '../api';

/**
 * Эпик 5 / Story 5.9: offerer-стол «История выплат».
 *
 * Поставщик видит исходящие выплаты по своим актам приёмки и их статус.
 * Вёрстка по канону MONO Platform v2: инфо-баннер, canon-таблица
 * (`.table-wrap`) со статус-бейджами, скелетон вместо спиннера, EmptyState.
 */

const items = ref<MarketplaceOutgoingPaymentRequestView[]>([]);
const loading = ref(false);

// Статус выплаты → человекочитаемая метка + canon-вариант бейджа.
const PAYMENT_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  AWAITING_AUTHORIZATION: { label: 'Ожидает решения совета', variant: 'warn' },
  PENDING: { label: 'Ожидает оплаты', variant: 'warn' },
  PROCESSING: { label: 'Обрабатывается', variant: 'info' },
  PAID: { label: 'Оплачен', variant: 'pos' },
  COMPLETED: { label: 'Обработан', variant: 'pos' },
  FAILED: { label: 'Не удался', variant: 'neg' },
  EXPIRED: { label: 'Истёк', variant: 'neutral' },
  CANCELLED: { label: 'Отменён', variant: 'neutral' },
  REFUNDED: { label: 'Отклонён', variant: 'neg' },
};

function statusOf(v?: string | null): { label: string; variant: BaseBadgeVariant } {
  if (!v) return { label: '—', variant: 'neutral' };
  return PAYMENT_STATUS[v] ?? PAYMENT_STATUS[v.toUpperCase()] ?? { label: v, variant: 'neutral' };
}

// Колонки скелетона повторяют шапку реальной таблицы — каркас не дёргается.
const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Дата', cell: 'text', cellWidth: '120px' },
  { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '80px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Референс банка', cell: 'text' },
  { label: 'Назначение', cell: 'text' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyPayments();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить историю выплат');
  } finally {
    loading.value = false;
  }
}

// Realtime: кассир подтвердил/отклонил перевод — строка истории меняет статус
// сразу. Новая PENDING-выплата рождается закрывающей подписью председателя,
// её приносит сигнал статуса акта приёмки (он тоже адресован поставщику).
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplacePaymentStatusChangedEvent: () => reloadLive(),
    MarketplaceAplReceptionStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
);

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-payments
  PageHint(storage-key='mp:offerer-payments:banner-dismissed')
    | Выплаты по вашим актам приёмки. Совет авторизует выплату, после чего
    | она уходит в банк — статус обновляется здесь по мере обработки.


  TableSkeleton(
    v-if='loading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='820px'
  )
  .table-wrap(v-else-if='items.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-date Дата
            th.col-num Сумма
            th.col-status Статус
            th Референс банка
            th Назначение
        tbody
          tr(v-for='row in items', :key='row.id')
            td.col-date {{ row.created_at }}
            td.col-num {{ row.amount }} {{ row.symbol }}
            td.col-status
              BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
            td {{ row.payment_reference || '—' }}
            td {{ row.purpose || '—' }}

  EmptyState(
    v-else,
    title='Выплат пока нет',
    body='Здесь появятся выплаты по вашим актам приёмки, когда совет их авторизует.'
  )
    template(#icon)
      q-icon(name='payments', size='48px')
</template>

<style scoped lang="scss">
.offerer-payments {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 820px;
}
.col-date {
  width: 160px;
  white-space: nowrap;
}
.col-num {
  width: 140px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.col-status {
  width: 200px;
}

@media (max-width: 768px) {
  .offerer-payments {
    padding: var(--p-4, 16px);
  }
}
</style>
