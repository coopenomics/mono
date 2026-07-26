<template lang="pug">
//- Список СЗ-расходов пула — переиспользуемый виджет шасси расходов.
//- Данные подаёт страница стола (Благорост, КУ, …): виджет не знает,
//- из какого пула расходы и каким запросом они получены.
//- Карточки на всю ширину (как голосования/результаты), сверху — свежие.
.expense-list
  .expense-list__skel(v-if='loading && !sortedRows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !sortedRows.length',
    :title='emptyTitle || "Расходов пока нет"',
    :body='emptyBody || "Создайте первый расход через кнопку «Создать расход» в шапке."'
  )
    template(#icon)
      q-icon(name='receipt_long', size='48px')

  .expense-list__items(v-else)
    .expense-list__card(
      v-for='row in sortedRows',
      :key='row.expense_hash',
      role='button',
      tabindex='0',
      @click='$emit("open", row.expense_hash)',
      @keydown.enter.prevent='$emit("open", row.expense_hash)',
      @keydown.space.prevent='$emit("open", row.expense_hash)'
    )
      .expense-list__main
        .expense-list__title-row
          span.expense-list__title {{ row.title || '— без описания —' }}
          BaseBadge(:variant='proposalStatusVariant(row.status)')
            | {{ proposalStatusLabel(row.status) }}

        .expense-list__sub
          span.t-sm.t-muted.t-mono № {{ shortExpenseId(row.expense_hash) }}
          span.expense-list__dot(v-if='row.creator_name') ·
          span.t-sm.t-muted(v-if='row.creator_name') {{ row.creator_name }}

      .expense-list__meta
        .expense-list__meta-item(v-if='row.created_at')
          span.expense-list__meta-label.t-eyebrow Создан
          span.expense-list__meta-value {{ formatDate(row.created_at) }}
        .expense-list__meta-item
          span.expense-list__meta-label.t-eyebrow Сумма
          span.expense-list__meta-value.t-mono {{ row.total_planned }}

      .expense-list__go
        q-icon(name='chevron_right', size='22px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge, EmptyState } from 'src/shared/ui/base';
import {
  proposalStatusLabel,
  proposalStatusVariant,
  shortExpenseId,
} from 'src/shared/lib/expenses';
import type { ExpenseProposalListProps, ExpenseProposalListRow } from './ExpenseProposalList.types';

const props = defineProps<ExpenseProposalListProps>();
defineEmits<{
  (e: 'open', expenseHash: string): void;
}>();

/** Свежие сверху — по created_at DESC; без даты — в конец. */
const sortedRows = computed<ExpenseProposalListRow[]>(() => {
  return [...props.rows].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
});

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
</script>

<style lang="scss" scoped>
.expense-list {
  min-width: 0;
}

.expense-list__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  .skel {
    height: 72px;
    border-radius: var(--p-r-md);
    background: var(--p-surface-2);
  }
}

.expense-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.expense-list__card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-5);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;

  &:hover {
    background: var(--p-canvas-2);
    border-color: var(--p-primary-line);

    .expense-list__go {
      color: var(--p-primary);
      background: var(--p-primary-soft);
    }

    .expense-list__meta-value {
      color: var(--p-ink);
    }
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
  }
}

.expense-list__main {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.expense-list__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  min-width: 0;
}

.expense-list__title {
  font-weight: 600;
  font-size: var(--p-fs-body);
  letter-spacing: -0.01em;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.expense-list__sub {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-1);
  min-width: 0;
}

.expense-list__dot {
  color: var(--p-ink-3);
}

.expense-list__meta {
  display: flex;
  align-items: center;
  gap: var(--p-5);
  flex-shrink: 0;
}

.expense-list__meta-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 5.5rem;
}

.expense-list__meta-label {
  color: var(--p-ink-3);
}

.expense-list__meta-value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--p-ink-1);
  white-space: nowrap;
  transition: color 0.12s ease;
}

.expense-list__go {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm);
  color: var(--p-ink-3);
  transition:
    color 0.12s ease,
    background-color 0.12s ease;
}

@media (max-width: 720px) {
  .expense-list__card {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'main go'
      'meta meta';
    gap: var(--p-3);
    padding: var(--p-3) var(--p-4);
  }

  .expense-list__main {
    grid-area: main;
  }

  .expense-list__meta {
    grid-area: meta;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: var(--p-4);
    padding-top: var(--p-2);
    border-top: 1px solid var(--p-line);
  }

  .expense-list__meta-item {
    align-items: flex-start;
  }

  .expense-list__go {
    grid-area: go;
  }
}
</style>
