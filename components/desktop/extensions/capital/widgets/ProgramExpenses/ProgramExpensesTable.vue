<template lang="pug">
q-card(flat, bordered)
  q-table(
    :rows='rows',
    :columns='columns',
    row-key='_id',
    flat,
    :loading='loading',
    :rows-per-page-options='[10, 25, 50]',
    :pagination='pagination',
    @row-click='onRowClick',
    @request='$emit(`request`, $event)',
    binary-state-sort
  )
    template(#body-cell-status='props')
      q-td(:props='props')
        q-chip(
          :color='statusColor(props.row.status)',
          text-color='white',
          dense,
          square
        ) {{ statusLabel(props.row.status) }}

    template(#body-cell-amount='props')
      q-td(:props='props', class='text-right')
        span.text-mono {{ formatAmount(props.row.amount) }}

    template(#body-cell-description='props')
      q-td(:props='props')
        .ellipsis(:title='props.row.description', style='max-width: 360px') {{ props.row.description || '—' }}

    template(#body-cell-spended_at='props')
      q-td(:props='props')
        span {{ formatDate(props.row.spended_at) }}

    template(#no-data)
      .row.full-width.justify-center.q-py-xl
        .text-center
          q-icon(name='inbox', size='48px', color='grey-5')
          .text-grey-7.q-mt-sm Расходов программы пока нет
          .text-grey-6.q-mt-xs.text-caption Когда председатель создаст служебную записку — она появится здесь
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { PropType } from 'vue';
import type { IProgramExpense } from 'app/extensions/capital/entities/ProgramExpense/model';

const props = defineProps({
  rows: { type: Array as PropType<IProgramExpense[]>, required: true },
  loading: { type: Boolean, default: false },
  pagination: {
    type: Object as PropType<{
      sortBy: string;
      descending: boolean;
      page: number;
      rowsPerPage: number;
      rowsNumber: number;
    }>,
    required: true,
  },
});

const emit = defineEmits<{
  (e: 'request', payload: { pagination: any }): void;
  (e: 'row-click', expense: IProgramExpense): void;
}>();

const columns = computed(() => [
  { name: 'expense_hash', label: '№', field: (r: IProgramExpense) => r.id ?? '—', align: 'left' as const, sortable: false },
  { name: 'description', label: 'Описание', field: 'description', align: 'left' as const, sortable: false },
  { name: 'amount', label: 'Сумма', field: 'amount', align: 'right' as const, sortable: false },
  { name: 'username', label: 'Инициатор', field: 'username', align: 'left' as const, sortable: false },
  { name: 'spended_at', label: 'Дата', field: 'spended_at', align: 'left' as const, sortable: true },
  { name: 'status', label: 'Статус', field: 'status', align: 'center' as const, sortable: false },
]);

function statusColor(status: string): string {
  const map: Record<string, string> = {
    created: 'orange',
    approved: 'blue',
    authorized: 'teal',
    paid: 'positive',
    declined: 'negative',
    undefined: 'grey-6',
  };
  return map[status] ?? 'grey-6';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    created: 'Создан',
    approved: 'Одобрен',
    authorized: 'Авторизован',
    paid: 'Выплачен',
    declined: 'Отклонён',
    undefined: 'Не определён',
  };
  return map[status] ?? status;
}

function formatAmount(amount?: string): string {
  if (!amount) return '—';
  return amount;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU');
}

function onRowClick(_evt: Event, row: IProgramExpense) {
  emit('row-click', row);
}

// suppress unused warning
void props;
</script>
