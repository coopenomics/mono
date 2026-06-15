<template lang="pug">
//- Список СЗ-расходов пула — переиспользуемый виджет шасси расходов.
//- Данные подаёт страница стола (Благорост, КУ, …): виджет не знает,
//- из какого пула расходы и каким запросом они получены.
.expense-proposal-list
  template(v-if='loading && !rows.length')
    .skel
      q-skeleton(type='rect', height='140px')
      q-skeleton(type='rect', height='140px')

  .row.q-col-gutter-md(v-else-if='rows.length')
    .col-12.col-md-6.col-lg-4(v-for='row in rows', :key='row.expense_hash')
      BaseCard.row-card-link(@click='$emit("open", row.expense_hash)')
        .row-card
          .row-card__head
            .row-card__title {{ row.title || '— без описания —' }}
            BaseChip(:variant='proposalStatusVariant(row.status)') {{ proposalStatusLabel(row.status) }}
          .row-card__amount {{ row.total_planned }}
          .row-card__meta
            .meta-row
              .meta-key № служебной записки
              .meta-val.t-mono {{ shortExpenseId(row.expense_hash) }}
            .meta-row(v-if='row.creator_name')
              .meta-key Инициатор
              .meta-val {{ row.creator_name }}
            .meta-row(v-if='row.created_at')
              .meta-key Создан
              .meta-val {{ formatDate(row.created_at) }}

  .empty(v-else)
    EmptyState(
      :title='emptyTitle || "Расходов пока нет"',
      :body='emptyBody || "Создайте первый расход через кнопку «Создать расход» в шапке."'
    )
      template(#icon)
        q-icon(name='receipt_long', size='48px')
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import {
  proposalStatusLabel,
  proposalStatusVariant,
  shortExpenseId,
} from 'src/shared/lib/expenses';
import type { ExpenseProposalListProps } from './ExpenseProposalList.types';

defineProps<ExpenseProposalListProps>();
defineEmits<{
  (e: 'open', expenseHash: string): void;
}>();

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}
</script>

<style lang="scss" scoped>
.skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.row-card-link {
  cursor: pointer;
}

.row-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.row-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
}

.row-card__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}

.row-card__amount {
  font-size: var(--p-fs-h3);
  font-weight: 700;
  color: var(--p-ink);
}

.row-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  font-size: var(--p-fs-body-sm);
}

.meta-key {
  color: var(--p-ink-2);
}

.meta-val {
  color: var(--p-ink);
}

.empty {
  margin-top: var(--p-6);
}
</style>
