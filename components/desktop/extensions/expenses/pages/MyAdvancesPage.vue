<template lang="pug">
.q-pa-md
  PageHead(
    :eyebrow='$t("expenses.myAdvancesPage.eyebrow")',
    :title='$t("expenses.myAdvancesPage.pageTitle")',
    :subtitle='$t("expenses.myAdvancesPage.pageSubtitle")'
  )

  .my-advances
    TableSkeleton(
      v-if='loading && !items.length',
      :columns='skeletonColumns',
      :rows='6',
      min-width='840px'
    )

    .table-wrap(v-else-if='items.length')
      .table-scroll
        table.table
          thead
            tr
              th.col-date {{ $t('expenses.myAdvancesPage.column.createdAt') }}
              th.col-num {{ $t('expenses.myAdvancesPage.column.amountPlan') }}
              th.col-num {{ $t('expenses.myAdvancesPage.column.amountFact') }}
              th {{ $t('expenses.myAdvancesPage.column.status') }}
              th {{ $t('expenses.myAdvancesPage.column.hash') }}
          tbody
            tr.data-row(
              v-for='row in items',
              :key='row.proposal_hash',
              @click='openDetail(row.proposal_hash)'
            )
              td {{ formatCreatedAt(row.created_at) }}
              td.col-num {{ row.total_planned || '—' }}
              td.col-num {{ row.total_actual || '—' }}
              td
                BaseBadge(:variant='statusVariant(row.status)') {{ statusLabel(row.status) }}
              td.col-hash.t-mono-sm {{ truncateHash(row.proposal_hash) }}

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) {{ $t('expenses.myAdvancesPage.loadMoreLabel') }}

    EmptyState(
      v-else,
      :title='$t("expenses.myAdvancesPage.emptyTitle")',
      :body='$t("expenses.myAdvancesPage.emptyHint")'
    )
      template(#icon)
        q-icon(name='savings', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { PageHead } from 'src/shared/ui/layout';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import {
  getExpenseProposalsByMember,
  type IExpenseProposalsByMemberResult,
} from '../api';
import {
  getExpenseProposalStatusLabel,
  getExpenseProposalStatusVariant,
} from '../model';
import { t } from '../i18n';

type IProposalRow = NonNullable<IExpenseProposalsByMemberResult['items']>[number];

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const loading = ref(false);
const items = ref<IProposalRow[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);

const PAGE_LIMIT = 25;

const skeletonColumns = computed<TableSkeletonColumn[]>(() => [
  { label: t('expenses.myAdvancesPage.column.createdAt'), cell: 'text', cellWidth: '120px' },
  { label: t('expenses.myAdvancesPage.column.amountPlan'), class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: t('expenses.myAdvancesPage.column.amountFact'), class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: t('expenses.myAdvancesPage.column.status'), cell: 'badge' },
  { label: t('expenses.myAdvancesPage.column.hash'), cell: 'text', cellWidth: '140px' },
]);

const hasMore = computed(() => currentPage.value < totalPages.value);

const rangeLabel = computed(() => {
  const shown = items.value.length;
  return shown ? t('expenses.myAdvancesPage.rangeSummary', { shown, total: totalCount.value }) : t('expenses.myAdvancesPage.zeroRangeSummary', { total: totalCount.value });
});

function statusLabel(status?: Zeus.ExpenseProposalStatus | null): string {
  return getExpenseProposalStatusLabel(status);
}

function statusVariant(status?: Zeus.ExpenseProposalStatus | null) {
  return getExpenseProposalStatusVariant(status);
}

function formatCreatedAt(createdAt?: string | null): string {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' });
}

function truncateHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

async function loadPage(page = 1): Promise<void> {
  const coopname = route.params.coopname as string;
  const username = session.username;
  if (!coopname || !username) return;
  try {
    loading.value = true;
    const result = await getExpenseProposalsByMember({
      coopname,
      username,
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
.my-advances {
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
}

.table {
  table-layout: fixed;
  min-width: 840px;
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

.data-row {
  cursor: pointer;
}
</style>
