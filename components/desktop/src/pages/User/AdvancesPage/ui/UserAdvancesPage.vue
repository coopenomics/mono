<template lang="pug">
q-page.advances-page
  PageHint(storage-key='participant:advances-page:banner-dismissed')
    | {{ $t('user.advancesPage.hint') }}

  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    row-key='proposal_hash',
    :loading='firstLoad',
    :skeleton-rows='6',
    min-width='820px',
    clickable-rows,
    @row-click='(row) => openDetail(row.proposal_hash)'
  )
    template(#cell-purpose='{ row }')
      | {{ advancePurpose(row) }}
    template(#cell-created_at='{ row }')
      | {{ formatProposalDate(row.created_at) }}
    template(#cell-advance='{ row }')
      | {{ formatProposalAmount(myAdvance(row)?.planned_amount) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='proposalStatusVariant(row.status)') {{ proposalStatusLabel(row.status) }}
    template(#footer)
      .advances-page__foot
        span {{ $t('user.advancesPage.rangeSummary', { shown: items.length, total: totalCount }) }}
        BaseButton(
          v-if='hasMore',
          variant='secondary',
          size='sm',
          :loading='loading',
          @click='loadMore'
        ) {{ $t('user.advancesPage.loadMore') }}

  EmptyState(
    v-else,
    :title='$t("user.advancesPage.emptyTitle")',
    :body='$t("user.advancesPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='savings', size='48px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';
import { useSessionStore } from 'src/entities/Session';
import { api, type IExpenseProposalRow } from 'src/entities/ExpenseProposal';
import {
  formatProposalAmount,
  formatProposalDate,
  proposalStatusLabel,
  proposalStatusVariant,
  useLiveProposalPages,
} from 'src/shared/lib/expenses';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';

/**
 * Авансы пайщика: служебные записки, по строкам которых он получает аванс
 * под отчёт. Строка открывает записку; отчитывается пайщик в своих платежах.
 */
const PAGE_LIMIT = 25;

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const { items, loading, firstLoad, totalCount, hasMore, loadMore } = useLiveProposalPages<IExpenseProposalRow>(
  async (options) => {
    const coopname = route.params.coopname as string;
    const username = session.username;
    if (!coopname || !username) return null;
    return api.loadAdvancesByMember({ coopname, username, options });
  },
  PAGE_LIMIT,
);

const columns = computed<BaseTableColumn<IExpenseProposalRow>[]>(() => [
  { key: 'purpose', label: t('user.advancesPage.column.purpose') },
  { key: 'created_at', label: t('user.advancesPage.column.date'), width: '150px', nowrap: true },
  { key: 'advance', label: t('user.advancesPage.column.advance'), width: '140px', numeric: true, nowrap: true },
  { key: 'status', label: t('user.advancesPage.column.status'), width: '200px', nowrap: true },
]);

/** Строка-аванс записки на имя вошедшего пайщика. */
function myAdvance(row: IExpenseProposalRow) {
  return row.items?.find(
    (item) => item.recipient === session.username && item.mechanics === Zeus.ExpenseMechanics.ADVANCE,
  );
}

function advancePurpose(row: IExpenseProposalRow): string {
  return myAdvance(row)?.description || t('user.advancesPage.noPurpose');
}

function openDetail(hash: string): void {
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

.advances-page__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  color: var(--p-ink-2);
}
</style>
