<template lang="pug">
q-page.cashier-page
  PageHint(storage-key='cashier:cashier-page:banner-dismissed')
    | {{ $t('cashier.cashierPage.hint') }}

  PageTabs(
    :tabs='tabs',
    :active-key='activeTab',
    @select='(tab) => onTabChange(tab.key)'
  )

  BaseTable(
    v-if='firstLoad || visible.length',
    :columns='columns',
    :rows='visible',
    row-key='proposal_hash',
    :loading='firstLoad',
    :skeleton-rows='6',
    min-width='880px',
    clickable-rows,
    @row-click='(row) => openDetail(row.proposal_hash)'
  )
    template(#cell-purpose='{ row }')
      | {{ proposalPurpose(row) || $t('cashier.cashierPage.noPurpose') }}
    template(#cell-member='{ row }')
      | {{ proposalAuthorName(row) }}
    template(#cell-created_at='{ row }')
      | {{ formatProposalDate(row.created_at) }}
    template(#cell-total_planned='{ row }')
      | {{ formatProposalAmount(row.total_planned) }}
    template(#cell-total_actual='{ row }')
      | {{ formatProposalAmount(row.total_actual) }}
    template(#footer)
      .cashier-page__foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='secondary',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) {{ $t('cashier.cashierPage.loadMore') }}

  EmptyState(
    v-else,
    :title='tabEmpty[activeTab].title',
    :body='tabEmpty[activeTab].body'
  )
    template(#icon)
      q-icon(name='point_of_sale', size='48px')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { api, type IExpenseProposalRow } from 'src/entities/ExpenseProposal';
import {
  formatProposalAmount,
  formatProposalDate,
  proposalAuthorName,
  proposalPurpose,
  useLiveProposalPages,
} from 'src/shared/lib/expenses';
import { BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs } from 'src/shared/ui/layout';
import { t } from '../i18n';

/**
 * Касса: служебные записки кооператива по этапам выплаты. Строка открывает
 * страницу записки; платежи по ней кассир проводит в реестре платежей.
 */
type TabKey = 'to_pay' | 'awaiting_report' | 'awaiting_authorize' | 'closed';

const PAGE_LIMIT = 50;

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

const activeTab = ref<TabKey>('to_pay');

const tabStatus: Record<TabKey, Zeus.ExpenseProposalStatus> = {
  to_pay: Zeus.ExpenseProposalStatus.AUTHORIZED,
  awaiting_report: Zeus.ExpenseProposalStatus.PARTIALLY_PAID,
  awaiting_authorize: Zeus.ExpenseProposalStatus.REPORT_SUBMITTED,
  closed: Zeus.ExpenseProposalStatus.CLOSED,
};

const tabEmpty: Record<TabKey, { title: string; body: string }> = {
  to_pay: { title: t('cashier.cashierPage.empty.toPayTitle'), body: t('cashier.cashierPage.empty.toPayBody') },
  awaiting_report: { title: t('cashier.cashierPage.empty.awaitingReportTitle'), body: t('cashier.cashierPage.empty.awaitingReportBody') },
  awaiting_authorize: { title: t('cashier.cashierPage.empty.awaitingAuthorizeTitle'), body: t('cashier.cashierPage.empty.awaitingAuthorizeBody') },
  closed: { title: t('cashier.cashierPage.empty.closedTitle'), body: t('cashier.cashierPage.empty.closedBody') },
};

const countByTab = (key: TabKey): number => items.value.filter((p) => p.status === tabStatus[key]).length;

const tabs = computed(() => [
  { key: 'to_pay', label: t('cashier.cashierPage.tab.toPay'), count: countByTab('to_pay') },
  { key: 'awaiting_report', label: t('cashier.cashierPage.tab.awaitingReport'), count: countByTab('awaiting_report') },
  { key: 'awaiting_authorize', label: t('cashier.cashierPage.tab.awaitingAuthorize'), count: countByTab('awaiting_authorize') },
  { key: 'closed', label: t('cashier.cashierPage.tab.closed'), count: countByTab('closed') },
]);

const visible = computed(() => items.value.filter((p) => p.status === tabStatus[activeTab.value]));

const columns = computed<BaseTableColumn<IExpenseProposalRow>[]>(() => [
  { key: 'purpose', label: t('cashier.cashierPage.column.purpose') },
  { key: 'member', label: t('cashier.cashierPage.column.member'), width: '220px' },
  { key: 'created_at', label: t('cashier.cashierPage.column.date'), width: '150px', nowrap: true },
  { key: 'total_planned', label: t('cashier.cashierPage.column.plan'), width: '130px', numeric: true, nowrap: true },
  { key: 'total_actual', label: t('cashier.cashierPage.column.fact'), width: '130px', numeric: true, nowrap: true },
]);

const rangeLabel = computed(() =>
  t('cashier.cashierPage.rangeSummary', { shown: visible.value.length, loaded: items.value.length, total: totalCount.value }),
);

function onTabChange(key: string): void {
  activeTab.value = key as TabKey;
}

function openDetail(hash: string): void {
  void router.push({ name: 'expenses-detail', params: { hash } });
}
</script>

<style lang="scss" scoped>
.cashier-page {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

@media (max-width: 768px) {
  .cashier-page {
    padding: var(--p-4);
  }
}

.cashier-page__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  color: var(--p-ink-2);
}
</style>
