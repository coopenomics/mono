<template lang="pug">
.payments-table
  TableSkeleton(
    v-if='onLoading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    :min-width='hideActions ? "880px" : "1000px"'
  )
  .table-wrap(v-else-if='items.length')
    .table-scroll
      table.table(:class='{ "table--actions": !hideActions }')
        thead
          tr
            th.col-toggle
            th.col-sort(@click='onSort("username")') Пайщик {{ sortMark('username') }}
            th.col-sort.col-date(@click='onSort("created_at")') Дата создания {{ sortMark('created_at') }}
            th.col-sort.col-num(@click='onSort("quantity")') Сумма {{ sortMark('quantity') }}
            th Тип платежа
            th Направление
            th.col-sort(@click='onSort("status")') Статус {{ sortMark('status') }}
            th.col-action(v-if='!hideActions') Действия
        tbody
          template(v-for='row in items', :key='row.id')
            tr.data-row(@click='toggleExpand(row.id)')
              td.col-toggle
                button.icon-btn(
                  type='button',
                  :aria-label='expanded.get(row.id) ? "Свернуть" : "Развернуть"',
                  @click.stop='toggleExpand(row.id)'
                )
                  q-icon(:name='expanded.get(row.id) ? "expand_more" : "chevron_right"')
              td.cell-name {{ getShortNameFromCertificate(row.username_certificate) || row.username }}
              td {{ formatDateToHumanDateTime(row.created_at) }}
              td.col-num {{ row.quantity }} {{ row.symbol }}
              td {{ row.type_label }}
              td
                span.dir(:class='isIncoming(row.direction) ? "dir--in" : "dir--out"')
                  q-icon.q-mr-xs(:name='getDirectionIcon(row.direction)', size='16px')
                  span {{ row.direction_label }}
              td
                BaseBadge(:variant='getStatusVariant(row.status)') {{ row.status_label }}
              td.col-action(v-if='!hideActions', @click.stop)
                .cell-actions(v-if='["EXPIRED", "PENDING", "FAILED"].includes(row.status)')
                  SetOrderPaidStatusButton(:id='row.id')
                  SetOrderRefundedStatusButton(:id='row.id')
                span.no-actions(v-else) —

            tr.expand-row(v-if='expanded.get(row.id)')
              td(:colspan='hideActions ? 7 : 8')
                PaymentDetails(:payment='row')

    .table-foot
      span {{ rangeLabel }}
      BaseButton(
        v-if='hasMore',
        variant='ghost',
        size='sm',
        :loading='onLoading',
        @click='loadMore'
      ) Загрузить ещё

  EmptyState(
    v-else,
    title='Платежи не найдены',
    body='Здесь появятся ваши платежи и взносы.'
  )
    template(#icon)
      q-icon(name='receipt_long', size='48px')
</template>

<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue';
import { FailAlert } from 'src/shared/api';
import { usePaymentStore } from 'src/entities/Payment/model';
import { SetOrderPaidStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderPaidStatusButton';
import { SetOrderRefundedStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderRefundedStatusButton';
import { PaymentDetails } from 'src/shared/ui';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import { Zeus } from '@coopenomics/sdk';

const props = defineProps({
  username: {
    type: String,
    required: false,
    default: null,
  },
  hideActions: {
    type: Boolean,
    default: false,
  },
});

const paymentStore = usePaymentStore();
const payments = computed(() => paymentStore.payments);
const items = computed(() => payments.value?.items ?? []);
const onLoading = ref(false);

// Статус платежа → canon-вариант бейджа (точка + цвет из дизайн-токенов).
const statusVariants: Record<string, BaseBadgeVariant> = {
  [Zeus.PaymentStatus.COMPLETED]: 'pos',
  [Zeus.PaymentStatus.PENDING]: 'warn',
  [Zeus.PaymentStatus.FAILED]: 'neg',
  [Zeus.PaymentStatus.PAID]: 'info',
  [Zeus.PaymentStatus.REFUNDED]: 'neutral',
  [Zeus.PaymentStatus.EXPIRED]: 'neutral',
};
const getStatusVariant = (status?: string | null): BaseBadgeVariant => {
  if (!status) return 'neutral';
  return statusVariants[status] || 'neutral';
};

const isIncoming = (direction?: string | null): boolean =>
  direction === Zeus.PaymentDirection.INCOMING;

const getDirectionIcon = (direction?: string | null) => {
  return isIncoming(direction)
    ? 'fa-solid fa-arrow-down'
    : 'fa-solid fa-arrow-up';
};

// Колонки скелетона повторяют шапку реальной таблицы платежей; колонка
// «Действия» появляется только когда экшены не скрыты — как и в таблице.
const skeletonColumns = computed<TableSkeletonColumn[]>(() => {
  const cols: TableSkeletonColumn[] = [
    { class: 'col-toggle', cell: 'icon' },
    { label: 'Пайщик', cell: 'text' },
    { label: 'Дата создания', cell: 'text', cellWidth: '120px' },
    { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '64px' },
    { label: 'Тип платежа', cell: 'text' },
    { label: 'Направление', cell: 'text', cellWidth: '90px' },
    { label: 'Статус', cell: 'badge' },
  ];
  if (!props.hideActions) {
    cols.push({ label: 'Действия', class: 'col-action', cell: 'icon' });
  }
  return cols;
});

const sortState = reactive({ sortBy: '', sortDir: '' as '' | 'asc' | 'desc' });

const sortMark = (col: string): string => {
  if (sortState.sortBy !== col) return '';
  return sortState.sortDir === 'asc' ? '↑' : '↓';
};

const onSort = (col: string): void => {
  if (sortState.sortBy === col) {
    sortState.sortDir = sortState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.sortBy = col;
    sortState.sortDir = 'asc';
  }
  paymentStore.clear();
  expanded.clear();
  loadPayments(1);
};

const loadPayments = async (page = 1): Promise<void> => {
  try {
    onLoading.value = true;
    const data = props.username ? { username: props.username } : undefined;
    const options = {
      page,
      limit: 25,
      sortBy: sortState.sortBy || undefined,
      sortOrder: sortState.sortDir
        ? (sortState.sortDir.toUpperCase() as 'ASC' | 'DESC')
        : 'ASC',
    };
    await paymentStore.loadPayments(data, options);

    // Платежи с ошибкой разворачиваем сразу — пользователю важна причина.
    items.value.forEach((p) => {
      if (p.status === Zeus.PaymentStatus.FAILED) expanded.set(p.id, true);
    });
  } catch (e: any) {
    FailAlert(e);
  } finally {
    onLoading.value = false;
  }
};

const hasMore = computed(
  () => (payments.value?.currentPage ?? 1) < (payments.value?.totalPages ?? 1),
);

const rangeLabel = computed(() => {
  const total = payments.value?.totalCount ?? items.value.length;
  const shown = items.value.length;
  return shown ? `1–${shown} из ${total}` : `0 из ${total}`;
});

const loadMore = (): void => {
  if (onLoading.value || !hasMore.value) return;
  loadPayments((payments.value?.currentPage ?? 1) + 1);
};

const expanded = reactive(new Map<string | number, boolean>());
const toggleExpand = (id: string | number): void => {
  expanded.set(id, !expanded.get(id));
};

onMounted(() => {
  paymentStore.clear();
  expanded.clear();
  loadPayments();
});
</script>

<style lang="scss" scoped>
.payments-table {
  width: 100%;
}

/* Горизонтальный скролл на узких экранах — вместо отдельной мобильной
   карточной верстки: таблица остаётся таблицей, просто прокручивается. */
.table-scroll {
  overflow-x: auto;
}

.table {
  table-layout: fixed;
  min-width: 860px;
}
.table--actions {
  min-width: 980px;
}

.col-toggle {
  width: 44px;
  text-align: center;
}
.col-date {
  width: 132px;
  white-space: nowrap;
}
.col-action {
  width: 168px;
  text-align: right;
}

.col-sort {
  cursor: pointer;
  user-select: none;
}

/* Действия над платежом — компактной стопкой, прижатой к правому краю
   колонки (td выровнен вправо). Равная ширина кнопок — через align-items:
   stretch внутри inline-flex; слева остаётся воздух от статуса. */
.cell-actions {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--p-2, 8px);
}

.cell-name {
  overflow-wrap: anywhere;
}

.dir {
  display: inline-flex;
  align-items: center;
}
.dir--in {
  color: var(--p-pos);
}
.dir--out {
  color: var(--p-neg);
}

.no-actions {
  color: var(--p-ink-3);
}

.data-row {
  cursor: pointer;
}

.expand-row td {
  padding: 0 20px 16px;
  background: var(--p-surface-2);
}
</style>
