<template lang="pug">
q-page.expenses-registry
  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    row-key='proposal_hash',
    :loading='firstLoad',
    :skeleton-rows='6',
    min-width='800px',
    clickable-rows,
    @row-click='(row) => openDetail(row.proposal_hash)'
  )
    template(#cell-purpose='{ row }')
      .cell-purpose__text {{ proposalPurpose(row) || $t('expenses.expensesRegistryPage.noDescriptionLabel') }}
      //- Кошелёк-источник — мета-строкой под назначением: отдельная колонка
      //- не помещается в окно 1120px с меню.
      .cell-purpose__meta {{ walletLabel(row.source_wallet) }}
    template(#cell-member='{ row }')
      .cell-payer__fio {{ proposalAuthorName(row) }}
      button.cell-payer__acc(
        type='button',
        :title='$t("expenses.expensesRegistryPage.copyAccountTitle")',
        @click.stop='copyAccount(row.username)'
      )
        span.t-mono-sm {{ row.username }}
        q-icon(name='content_copy', size='12px')
    template(#cell-created_at='{ row }')
      | {{ formatProposalDate(row.created_at) }}
    template(#cell-total_planned='{ row }')
      | {{ formatProposalAmount(row.total_planned) }}
    template(#cell-total_actual='{ row }')
      | {{ formatProposalAmount(row.total_actual) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='getExpenseProposalStatusVariant(row.status)') {{ getExpenseProposalStatusLabel(row.status) }}
    template(#footer)
      .expenses-registry__foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='secondary',
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { copyToClipboard, Notify } from 'quasar';
import { api, type IExpenseProposalRow } from 'src/entities/ExpenseProposal';
import { listExpenseWallets } from 'src/shared/lib/expense-wallets';
import {
  formatProposalAmount,
  formatProposalDate,
  proposalAuthorName,
  proposalPurpose,
  useLiveProposalPages,
} from 'src/shared/lib/expenses';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { getExpenseProposalStatusLabel, getExpenseProposalStatusVariant } from '../model';
import { t } from '../i18n';

const PAGE_LIMIT = 25;

const route = useRoute();
const router = useRouter();

const { items, loading, firstLoad, totalCount, hasMore, loadMore } = useLiveProposalPages<IExpenseProposalRow>(
  async (options) => {
    const coopname = route.params.coopname as string;
    if (!coopname) return null;
    return api.loadProposalsByCooperative({ coopname, options });
  },
  PAGE_LIMIT,
);

// Ширины колонок вместе с колонкой назначения укладываются в min-width
// таблицы (800px), а он — в ширину страницы на окне 1120px с меню.
// Дата переносится в две строки, кошелёк идёт мета-строкой под назначением.
const columns = computed<BaseTableColumn<IExpenseProposalRow>[]>(() => [
  { key: 'purpose', label: t('expenses.expensesRegistryPage.column.purpose') },
  { key: 'member', label: t('expenses.expensesRegistryPage.column.member'), width: '150px' },
  { key: 'created_at', label: t('expenses.expensesRegistryPage.column.createdAt'), width: '120px' },
  { key: 'total_planned', label: t('expenses.expensesRegistryPage.column.amountPlan'), width: '110px', numeric: true, nowrap: true },
  { key: 'total_actual', label: t('expenses.expensesRegistryPage.column.amountFact'), width: '110px', numeric: true, nowrap: true },
  { key: 'status', label: t('expenses.expensesRegistryPage.column.status'), width: '170px', nowrap: true },
]);

// Код кошелька-пула (`w.cap.pgexp`) → человеческое имя из реестра пулов; если
// расширение не зарегистрировало пул — показываем сам код, не пустоту.
const walletTitles = new Map(listExpenseWallets().map((e) => [e.wallet, e.title]));
function walletLabel(code?: string | null): string {
  if (!code) return '—';
  return walletTitles.get(code) ?? code;
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

const rangeLabel = computed(() => {
  const shown = items.value.length;
  return shown
    ? t('expenses.expensesRegistryPage.rangeSummary', { shown, total: totalCount.value })
    : t('expenses.expensesRegistryPage.zeroRangeSummary', { total: totalCount.value });
});

function openDetail(hash: string): void {
  void router.push({ name: 'expenses-detail', params: { hash } });
}
</script>

<style lang="scss" scoped>
.expenses-registry {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

@media (max-width: 768px) {
  .expenses-registry {
    padding: var(--p-4);
  }
}

.expenses-registry__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  color: var(--p-ink-2);
}

.cell-purpose__text {
  overflow-wrap: break-word;
}

.cell-purpose__meta {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
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
  margin-top: var(--p-1);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-3);
  cursor: pointer;

  &:hover {
    color: var(--p-primary);
  }
}
</style>
