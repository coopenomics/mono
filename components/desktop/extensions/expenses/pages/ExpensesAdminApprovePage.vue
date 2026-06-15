<template lang="pug">
.q-pa-md
  PageHead(
    eyebrow='Шасси расходов · Председатель',
    title='На одобрение председателя',
    subtitle='Очередь служебных записок в статусе «Подан» — ждут подписи председателя'
  )

  .admin-queue
    TableSkeleton(
      v-if='loading && !filtered.length',
      :columns='skeletonColumns',
      :rows='6',
      min-width='880px'
    )

    .table-wrap(v-else-if='filtered.length')
      .table-scroll
        table.table
          thead
            tr
              th Пайщик
              th.col-date Дата создания
              th.col-num Сумма (план)
              th Хеш
              th.col-actions
          tbody
            tr.data-row(
              v-for='row in filtered',
              :key='row.proposal_hash',
              @click='openDetail(row.proposal_hash)'
            )
              td.cell-name {{ row.username || '—' }}
              td {{ formatCreatedAt(row.created_at) }}
              td.col-num {{ row.total_planned || '—' }}
              td.col-hash.t-mono-sm {{ truncateHash(row.proposal_hash) }}
              td.col-actions
                BaseButton(
                  variant='ghost',
                  size='sm',
                  icon='chevron_right',
                  @click.stop='openDetail(row.proposal_hash)'
                ) Открыть

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) Загрузить ещё

    EmptyState(
      v-else,
      title='Очередь пуста',
      body='Все поданные служебные записки уже рассмотрены.'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { PageHead } from 'src/shared/ui/layout';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { FailAlert } from 'src/shared/api';
import {
  getExpenseProposalsByCooperative,
  type IExpenseProposalsByCooperativeResult,
} from '../api';

type IProposalRow = NonNullable<IExpenseProposalsByCooperativeResult['items']>[number];

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const items = ref<IProposalRow[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);

const PAGE_LIMIT = 25;

const skeletonColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Пайщик', cell: 'text' },
  { label: 'Дата создания', cell: 'text', cellWidth: '120px' },
  { label: 'Сумма (план)', class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: 'Хеш', cell: 'text', cellWidth: '160px' },
  { label: '', cell: 'text', cellWidth: '120px' },
]);

const filtered = computed(() =>
  items.value.filter((p) => p.status === Zeus.ExpenseProposalStatus.CREATED),
);

const hasMore = computed(() => currentPage.value < totalPages.value);

const rangeLabel = computed(() => {
  const shown = filtered.value.length;
  return `${shown} в очереди · загружено ${items.value.length} из ${totalCount.value}`;
});

function formatCreatedAt(createdAt?: string | null): string {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function truncateHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

async function loadPage(page = 1): Promise<void> {
  const coopname = route.params.coopname as string;
  if (!coopname) return;
  try {
    loading.value = true;
    const result = await getExpenseProposalsByCooperative({
      coopname,
      options: {
        page,
        limit: PAGE_LIMIT,
        sortBy: 'created_at',
        sortOrder: 'ASC',
      },
    });
    const incoming = (result.items ?? []) as IProposalRow[];
    items.value = page === 1 ? incoming : [...items.value, ...incoming];
    currentPage.value = result.currentPage ?? page;
    totalPages.value = result.totalPages ?? 1;
    totalCount.value = result.totalCount ?? items.value.length;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function loadMore(): void {
  if (loading.value || !hasMore.value) return;
  void loadPage(currentPage.value + 1);
}

function openDetail(hash: string): void {
  void router.push({ name: 'expenses-detail', params: { hash } });
}

onMounted(() => {
  void loadPage(1);
});
</script>

<style lang="scss" scoped>
.admin-queue {
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
}

.table {
  table-layout: fixed;
  min-width: 880px;
}

.col-date {
  width: 132px;
  white-space: nowrap;
}

.col-num {
  width: 120px;
  white-space: nowrap;
  text-align: right;
}

.col-hash {
  width: 160px;
  color: var(--p-ink-2);
}

.col-actions {
  width: 140px;
  text-align: right;
}

.cell-name {
  overflow-wrap: anywhere;
}

.data-row {
  cursor: pointer;
}
</style>
