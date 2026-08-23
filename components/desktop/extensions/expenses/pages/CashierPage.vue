<template lang="pug">
.q-pa-md
  PageHead(
    eyebrow='Шасси расходов · Касса',
    title='Касса',
    subtitle='Очереди оплаты, ожидания отчётов и закрытых служебных записок'
  )

  PageTabs.q-mb-md(
    :tabs='tabs',
    :active-key='activeTab',
    @update:active-key='onTabChange'
  )

  .cashier
    TableSkeleton(
      v-if='loading && !items.length',
      :columns='skeletonColumns',
      :rows='6',
      min-width='880px'
    )

    .table-wrap(v-else-if='visible.length')
      .table-scroll
        table.table
          thead
            tr
              th Пайщик
              th.col-date Дата
              th.col-num План
              th.col-num Факт
              th Hash
              th.col-actions
          tbody
            tr.data-row(
              v-for='row in visible',
              :key='row.proposal_hash',
              @click='openDetail(row.proposal_hash)'
            )
              td.cell-name {{ row.username || '—' }}
              td {{ formatCreatedAt(row.created_at) }}
              td.col-num {{ row.total_planned || '—' }}
              td.col-num {{ row.total_actual || '—' }}
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
      :title='emptyTitle',
      :body='emptyBody'
    )
      template(#icon)
        q-icon(name='point_of_sale', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { PageHead, PageTabs } from 'src/shared/ui/layout';
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

type TabKey = 'to_pay' | 'awaiting_report' | 'awaiting_authorize' | 'closed';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const items = ref<IProposalRow[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);

const PAGE_LIMIT = 50;

const activeTab = ref<TabKey>('to_pay');

const tabStatusMap: Record<TabKey, Zeus.ExpenseProposalStatus> = {
  to_pay: Zeus.ExpenseProposalStatus.AUTHORIZED,
  awaiting_report: Zeus.ExpenseProposalStatus.PARTIALLY_PAID,
  awaiting_authorize: Zeus.ExpenseProposalStatus.REPORT_SUBMITTED,
  closed: Zeus.ExpenseProposalStatus.CLOSED,
};

const tabEmptyMap: Record<TabKey, { title: string; body: string }> = {
  to_pay: {
    title: 'Готовых к оплате нет',
    body: 'Здесь появятся служебные записки, утверждённые советом и ожидающие выплаты.',
  },
  awaiting_report: {
    title: 'Все оплаченные имеют отчёт',
    body: 'Здесь будут оплаченные авансы, по которым пайщик ещё не подал отчёт.',
  },
  awaiting_authorize: {
    title: 'Нет отчётов на авторизацию',
    body: 'Здесь будут отчёты, ожидающие утверждения председателем.',
  },
  closed: {
    title: 'Закрытых ещё нет',
    body: 'Здесь будут полностью закрытые служебные записки.',
  },
};

function countByTab(key: TabKey): number {
  return items.value.filter((p) => p.status === tabStatusMap[key]).length;
}

const tabs = computed(() => [
  { key: 'to_pay', label: 'К оплате', count: countByTab('to_pay') },
  { key: 'awaiting_report', label: 'Ждут отчёта', count: countByTab('awaiting_report') },
  { key: 'awaiting_authorize', label: 'На авторизации', count: countByTab('awaiting_authorize') },
  { key: 'closed', label: 'Закрытые', count: countByTab('closed') },
]);

const visible = computed(() =>
  items.value.filter((p) => p.status === tabStatusMap[activeTab.value]),
);

const skeletonColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Пайщик', cell: 'text' },
  { label: 'Дата', cell: 'text', cellWidth: '120px' },
  { label: 'План', class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: 'Факт', class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: 'Hash', cell: 'text', cellWidth: '160px' },
  { label: '', cell: 'text', cellWidth: '120px' },
]);

const hasMore = computed(() => currentPage.value < totalPages.value);

const rangeLabel = computed(() => {
  const shown = visible.value.length;
  return `${shown} на вкладке · загружено ${items.value.length} из ${totalCount.value}`;
});

const emptyTitle = computed(() => tabEmptyMap[activeTab.value].title);
const emptyBody = computed(() => tabEmptyMap[activeTab.value].body);

function onTabChange(key: string): void {
  activeTab.value = key as TabKey;
}

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
        sortOrder: 'DESC',
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
.cashier {
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
  width: 110px;
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
