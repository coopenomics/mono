<template lang="pug">
q-page.registry
  PageTabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')

  //- Реестр сравнивают по колонкам — таблица; подробности открывает правая панель.
  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    row-key='debt_hash',
    :loading='firstLoad',
    clickable-rows,
    @row-click='open'
  )
    template(#cell-number='{ row }')
      .registry__number {{ row.contract_number }}
      .registry__meta {{ sourceLabel(row.source) }}
    template(#cell-member='{ row }')
      IdentityCell(:account-name='row.username || ""')
    template(#cell-amount='{ row }') {{ formatAmount(row.amount) }}
    template(#cell-remaining='{ row }') {{ isOutstanding(row.status) ? formatAmount(row.remaining) : '' }}
    template(#cell-due='{ row }') {{ formatDate(row.due_at) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='loanStatusVariant(row.status)') {{ loanStatusLabel(row.status) }}

  EmptyState(
    v-if='!items.length && !firstLoad',
    :title='$t("debt.registryPage.emptyTitle")',
    :body='$t("debt.registryPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='request_quote', size='48px')

  .row.justify-center.q-my-md(v-if='hasMore')
    BaseButton(variant='ghost', :loading='loading', @click='loadMore') {{ $t('debt.loansPage.loadMoreAction') }}

  LoanDetailsDrawer(v-model='drawerOpen', :loan='active', show-member, @changed='reload(true)')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BaseBadge, BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable';
import { IdentityCell } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import type { ILoan } from '../api';
import {
  formatAmount,
  formatDate,
  isOutstanding,
  loanStatusLabel,
  loanStatusVariant,
  sourceLabel,
  useLoanList,
} from '../model';
import { t } from '../i18n';
import LoanDetailsDrawer from '../widgets/LoanDetailsDrawer.vue';

// Вкладка — одно состояние займа; «Все» отбора не ставит.
const TABS: Array<{ key: string; label: string; status?: string }> = [
  { key: 'all', label: t('debt.registryPage.tabAll') },
  { key: 'pending', label: t('debt.registryPage.tabPending'), status: 'CREATED' },
  { key: 'paying', label: t('debt.registryPage.tabPaying'), status: 'PAYING' },
  { key: 'issued', label: t('debt.registryPage.tabIssued'), status: 'ISSUED' },
  { key: 'overdue', label: t('debt.registryPage.tabOverdue'), status: 'OVERDUE' },
  { key: 'closed', label: t('debt.registryPage.tabClosed'), status: 'CLOSED' },
];
const tabs: PageTab[] = TABS.map(({ key, label }) => ({ key, label }));
const activeKey = ref('all');

const filter = computed(() => {
  const status = TABS.find((tab) => tab.key === activeKey.value)?.status;
  return status ? { status } : {};
});
const { items, loading, firstLoad, hasMore, reload, reset, loadMore } = useLoanList(filter);

const columns: BaseTableColumn<ILoan>[] = [
  { key: 'number', label: t('debt.registryPage.columnNumber') },
  { key: 'member', label: t('debt.registryPage.columnMember') },
  { key: 'amount', label: t('debt.registryPage.columnAmount'), numeric: true, nowrap: true },
  { key: 'remaining', label: t('debt.registryPage.columnRemaining'), numeric: true, nowrap: true },
  { key: 'due', label: t('debt.registryPage.columnDue'), nowrap: true },
  { key: 'status', label: t('debt.registryPage.columnStatus'), nowrap: true, width: '260px' },
];

const drawerOpen = ref(false);
const activeHash = ref<string | null>(null);
const active = computed<ILoan | null>(() => items.value.find((l) => l.debt_hash === activeHash.value) ?? null);

function open(loan: ILoan): void {
  activeHash.value = loan.debt_hash;
  drawerOpen.value = true;
}

function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key;
  void reset();
}

onMounted(reload);
</script>

<style scoped lang="scss">
.registry {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-5);
}

.registry__number {
  font-family: var(--p-mono);
  font-weight: 600;
  color: var(--p-ink);
}

.registry__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
