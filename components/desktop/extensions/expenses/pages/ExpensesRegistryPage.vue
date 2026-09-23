<template lang="pug">
.q-pa-md
  .expenses-registry
    TableSkeleton(
      v-if='loading && !items.length',
      :columns='skeletonColumns',
      :rows='6',
      min-width='980px'
    )

    .table-wrap(v-else-if='items.length')
      .table-scroll
        table.table
          thead
            tr
              th {{ $t('expenses.expensesRegistryPage.column.purpose') }}
              th {{ $t('expenses.expensesRegistryPage.column.member') }}
              th.col-wallet {{ $t('expenses.expensesRegistryPage.column.wallet') }}
              th.col-date {{ $t('expenses.expensesRegistryPage.column.createdAt') }}
              th.col-num {{ $t('expenses.expensesRegistryPage.column.amountPlan') }}
              th.col-num {{ $t('expenses.expensesRegistryPage.column.amountFact') }}
              th {{ $t('expenses.expensesRegistryPage.column.status') }}
              th.col-chevron
          tbody
            tr.data-row(
              v-for='row in items',
              :key='row.proposal_hash',
              @click='openDetail(row.proposal_hash)'
            )
              td.cell-name {{ purposeOf(row) }}
              td.cell-payer
                .cell-payer__fio {{ payerName(row) }}
                button.cell-payer__acc(
                  type='button',
                  :title='$t("expenses.expensesRegistryPage.copyAccountTitle")',
                  @click.stop='copyAccount(row.username)'
                )
                  span.t-mono-sm {{ row.username }}
                  q-icon(name='content_copy', size='12px')
              td.col-wallet {{ walletLabel(row.source_wallet) }}
              td {{ formatCreatedAt(row.created_at) }}
              td.col-num {{ formatAmount(row.total_planned) }}
              td.col-num {{ formatAmount(row.total_actual) }}
              td
                BaseBadge(:variant='statusVariant(row.status)') {{ statusLabel(row.status) }}
              td.col-chevron
                q-icon(name='chevron_right', size='20px')

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) {{ $t('expenses.expensesRegistryPage.loadMoreLabel') }}

    EmptyState(
      v-else,
      :title='$t("expenses.expensesRegistryPage.emptyTitle")',
      :body='$t("expenses.expensesRegistryPage.emptyHint")'
    )
      template(#icon)
        q-icon(name='receipt_long', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { useRoute, useRouter } from 'vue-router';
import { copyToClipboard, Notify } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { listExpenseWallets } from 'src/shared/lib/expense-wallets';
import {
  getExpenseProposalsByCooperative,
  type IExpenseProposalsByCooperativeResult,
} from '../api';
import {
  getExpenseProposalStatusLabel,
  getExpenseProposalStatusVariant,
} from '../model';
import { t } from '../i18n';

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
  { label: t('expenses.expensesRegistryPage.column.purpose'), cell: 'text' },
  { label: t('expenses.expensesRegistryPage.column.member'), cell: 'text' },
  { label: t('expenses.expensesRegistryPage.column.wallet'), class: 'col-wallet', cell: 'text', cellWidth: '200px' },
  { label: t('expenses.expensesRegistryPage.column.createdAt'), cell: 'text', cellWidth: '120px' },
  { label: t('expenses.expensesRegistryPage.column.amountPlan'), class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: t('expenses.expensesRegistryPage.column.amountFact'), class: 'col-num', cell: 'text', cellWidth: '110px' },
  { label: t('expenses.expensesRegistryPage.column.status'), cell: 'badge' },
  { label: '', class: 'col-chevron', cell: 'text', cellWidth: '40px' },
]);

// Код кошелька-пула (`w.cap.pgexp`) → человеческое имя из реестра пулов; если
// расширение не зарегистрировало пул — показываем сам код, не пустоту.
const walletTitles = new Map(listExpenseWallets().map((e) => [e.wallet, e.title]));
function walletLabel(code?: string | null): string {
  if (!code) return '—';
  return walletTitles.get(code) ?? code;
}

// ФИО пайщика берём из сертификата подписанта служебной записки (СЗ подписывает
// её создатель) — так не нужен отдельный запрос аккаунта. Если СЗ ещё не
// подписана — показываем имя аккаунта.
function payerName(row: IProposalRow): string {
  const cert = row.statement_doc?.document?.signatures?.[0]?.signer_certificate;
  return (cert ? getNameFromCertificate(cert) : '') || row.username || '—';
}

async function copyAccount(username?: string | null): Promise<void> {
  if (!username) return;
  try {
    await copyToClipboard(username);
    Notify.create({ type: 'positive', message: t('expenses.expensesRegistryPage.copiedMessage'), timeout: 1200 });
  } catch {
    // молча: копирование — вспомогательное действие
  }
}

function formatAmount(asset?: string | null): string {
  if (!asset) return '—';
  return formatAsset2Digits(asset);
}

function purposeOf(row: IProposalRow): string {
  return row.items?.[0]?.description || t('expenses.expensesRegistryPage.noDescriptionLabel');
}

const hasMore = computed(() => currentPage.value < totalPages.value);

const rangeLabel = computed(() => {
  const shown = items.value.length;
  return shown ? t('expenses.expensesRegistryPage.rangeSummary', { shown, total: totalCount.value }) : t('expenses.expensesRegistryPage.zeroRangeSummary', { total: totalCount.value });
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
.expenses-registry {
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
}

/* Глобальный канон форсит .table{min-width:0!important} — без !important
   колонки схлопываются уже контента и текст рвётся посимвольно в столбик.
   Перебиваем !important: при нехватке ширины таблица скроллится в
   .table-scroll, а не ломает слова (эталон — реестр платежей). */
.table {
  table-layout: fixed !important;
  min-width: 1080px !important;
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

.col-wallet {
  width: 200px;
  color: var(--p-ink-2);
  overflow-wrap: break-word;
}

.cell-name {
  overflow-wrap: break-word;
}

/* Пайщик: ФИО первой строкой, имя аккаунта ниже — кликом копируется. */
.cell-payer__fio {
  color: var(--p-ink);
  overflow-wrap: break-word;
}

.cell-payer__acc {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  margin-top: 2px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-3);
  cursor: pointer;

  &:hover {
    color: var(--p-primary);
  }
}

/* Колонка-шеврон: подсказывает, что строка открывается. */
.col-chevron {
  width: 40px;
  text-align: center;
  color: var(--p-ink-3);
}

.data-row {
  cursor: pointer;
}

.data-row:hover .col-chevron {
  color: var(--p-primary);
}
</style>
