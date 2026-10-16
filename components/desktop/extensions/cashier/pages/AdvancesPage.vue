<template lang="pug">
q-page.advances-page
  PageHint(storage-key='cashier:advances-page:banner-dismissed')
    | {{ $t('cashier.advancesPage.hint') }}

  PageTabs(
    :tabs='tabs',
    :active-key='activeTab',
    @select='(tab) => onTabChange(tab.key)'
  )

  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    :row-key='rowKey',
    :loading='firstLoad',
    :skeleton-rows='6',
    min-width='760px',
    clickable-rows,
    @row-click='(row) => openProposal(row.proposal_hash)'
  )
    template(#cell-recipient='{ row }')
      | {{ row.recipient_name || row.recipient }}
    template(#cell-description='{ row }')
      .advances-page__purpose {{ row.description || $t('cashier.advancesPage.noPurpose') }}
      .advances-page__meta {{ $t('cashier.advancesPage.issuedMeta', { date: formatProposalDay(row.issued_at) }) }}
    template(#cell-advance_amount='{ row }')
      | {{ formatProposalAmount(row.advance_amount) }}
    template(#cell-spent_amount='{ row }')
      | {{ formatProposalAmount(row.spent_amount) }}
    template(#cell-state='{ row }')
      BaseBadge(:variant='stateVariant[row.state]') {{ stateLabel(row.state) }}
    template(#footer)
      .advances-page__foot
        span {{ $t('cashier.advancesPage.rangeSummary', { shown: items.length, total: totalCount }) }}
        BaseButton(
          v-if='hasMore',
          variant='secondary',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) {{ $t('cashier.advancesPage.loadMore') }}

  EmptyState(
    v-else,
    :title='$t("cashier.advancesPage.emptyTitle")',
    :body='$t("cashier.advancesPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='savings', size='48px')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { api, type IExpenseAdvanceRow } from 'src/entities/ExpenseProposal';
import { formatProposalAmount, formatProposalDay, useLiveProposalPages } from 'src/shared/lib/expenses';
import {
  BaseBadge,
  BaseButton,
  BaseTable,
  EmptyState,
  type BaseBadgeVariant,
  type BaseTableColumn,
} from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs } from 'src/shared/ui/layout';
import { t } from '../i18n';

/**
 * Авансы под отчёт по кооперативу: кому выдан аванс, по какой записке, сколько
 * потрачено и в каком он состоянии. Строка открывает служебную записку;
 * отчёт и расчёт разницы кассир проводит в реестре платежей.
 */
type TabKey = 'all' | Zeus.ExpenseAdvanceState;

const PAGE_LIMIT = 50;

const route = useRoute();
const router = useRouter();
const activeTab = ref<TabKey>('all');

const { items, loading, firstLoad, totalCount, hasMore, loadMore, reload } = useLiveProposalPages<IExpenseAdvanceRow>(
  async (options) => {
    const coopname = route.params.coopname as string;
    if (!coopname) return null;
    const filter = activeTab.value === 'all' ? undefined : { state: activeTab.value };
    return api.loadAdvancesByCooperative({ coopname, filter, options });
  },
  PAGE_LIMIT,
  // Расчёт разницы по авансу идёт платёжкой в реестре платежей.
  [{ code: 'core', table: 'payments' }],
);

const stateKey: Record<Zeus.ExpenseAdvanceState, string> = {
  [Zeus.ExpenseAdvanceState.AWAITING_REPORT]: 'awaitingReport',
  [Zeus.ExpenseAdvanceState.SETTLEMENT]: 'settlement',
  [Zeus.ExpenseAdvanceState.REPORTED]: 'reported',
};

const stateVariant: Record<Zeus.ExpenseAdvanceState, BaseBadgeVariant> = {
  [Zeus.ExpenseAdvanceState.AWAITING_REPORT]: 'warn',
  [Zeus.ExpenseAdvanceState.SETTLEMENT]: 'info',
  [Zeus.ExpenseAdvanceState.REPORTED]: 'pos',
};

function stateLabel(state: Zeus.ExpenseAdvanceState): string {
  return t(`cashier.advancesPage.state.${stateKey[state]}` as never);
}

const tabs = computed(() => [
  { key: 'all', label: t('cashier.advancesPage.tab.all') },
  ...Object.values(Zeus.ExpenseAdvanceState).map((state) => ({ key: state, label: stateLabel(state) })),
]);

// Колонки укладываются в min-width таблицы (760px), а он — в ширину страницы
// на окне 1120px с меню; дата выдачи идёт мета-строкой под назначением.
const columns = computed<BaseTableColumn<IExpenseAdvanceRow>[]>(() => [
  { key: 'recipient', label: t('cashier.advancesPage.column.recipient'), width: '160px' },
  { key: 'description', label: t('cashier.advancesPage.column.purpose') },
  { key: 'advance_amount', label: t('cashier.advancesPage.column.advance'), width: '120px', numeric: true, nowrap: true },
  { key: 'spent_amount', label: t('cashier.advancesPage.column.spent'), width: '120px', numeric: true, nowrap: true },
  { key: 'state', label: t('cashier.advancesPage.column.state'), width: '190px', nowrap: true },
]);

const rowKey = (row: IExpenseAdvanceRow): string => `${row.proposal_hash}:${row.item_hash}`;

function onTabChange(key: string): void {
  activeTab.value = key as TabKey;
  void reload();
}

function openProposal(hash: string): void {
  void router.push({ name: 'expenses-detail', params: { hash } });
}
</script>

<style lang="scss" scoped>
.advances-page {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

@media (max-width: 768px) {
  .advances-page {
    padding: var(--p-4);
  }
}

.advances-page__purpose {
  overflow-wrap: break-word;
}

.advances-page__meta {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.advances-page__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  color: var(--p-ink-2);
}
</style>
