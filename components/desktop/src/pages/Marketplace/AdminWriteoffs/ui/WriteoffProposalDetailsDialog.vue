<script lang="ts" setup>
import { computed } from 'vue';
import { uiLocale, t } from 'src/shared/i18n';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { BaseDialog, BaseBadge, BaseCard, BaseTable } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { ActivityTimeline } from 'src/shared/ui/domain/ActivityTimeline';
import type { ActivityEvent, ActivityEventType } from 'src/shared/ui/domain/ActivityTimeline';
import type { MarketplaceWriteoffProposalView } from '../api';
import { positionsLabel, proposalTitle } from '../lib/proposalDisplay';

const props = defineProps<{
  modelValue: boolean;
  proposal: MarketplaceWriteoffProposalView;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function itemQuantityLabel(it: { quantity: string; unit_of_measure?: string | null; package_size?: number | null }): string {
  return marketplaceOrderSaleUnitLabel(Number.parseFloat(it.quantity) || 0, it.unit_of_measure, it.package_size);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(uiLocale());
}

function humanStatus(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return t('marketplace.writeoff.status.draft');
    case 'ON_AGENDA':
      return t('marketplace.writeoffDetailsDialog.status.onAgendaFull');
    case 'AUTHORIZED':
      return 'Утверждено советом';
    case 'PENDING_CONFIRMATION':
      return t('marketplace.writeoff.status.pendingWarehouse');
    case 'EXECUTING':
      return t('marketplace.writeoff.status.inProgress');
    case 'EXECUTED':
      return t('marketplace.writeoff.status.done');
    case 'REJECTED':
      return t('marketplace.writeoff.status.rejected');
    default:
      return String(status);
  }
}

// Итог рассмотрения советом — человеку, не служебный номер решения.
function councilOutcome(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return t('marketplace.writeoffDetailsDialog.decisionStatus.notSubmitted');
    case 'ON_AGENDA':
      return t('marketplace.writeoffDetailsDialog.decisionStatus.underReview');
    case 'REJECTED':
      return t('marketplace.writeoffDetailsDialog.decisionStatus.rejectedBySoviet');
    default:
      return t('marketplace.writeoffDetailsDialog.decisionStatus.approvedBySoviet');
  }
}

// Журнал решений — коды действий в человеческие формулировки + тип события
// для канонического таймлайна (иконка/цвет берутся из типа).
const LOG_LABELS: Record<string, string> = {
  draft_created: t('marketplace.writeoffDetailsDialog.event.draftCreated'),
  draft_updated: t('marketplace.writeoffDetailsDialog.event.compositionChanged'),
  submitted_to_council: t('marketplace.writeoffDetailsDialog.event.sentToSoviet'),
  authorized_by_council: t('marketplace.writeoffDetailsDialog.event.sovietApproved'),
  declined_by_council: t('marketplace.writeoffDetailsDialog.event.sovietRejected'),
  confirmed_by_branch: t('marketplace.writeoffDetailsDialog.event.confirmedByWarehouse'),
  execution_started: t('marketplace.writeoffDetailsDialog.event.writeoffStarted'),
  item_executed: t('marketplace.writeoffDetailsDialog.event.itemWrittenOff'),
  execution_completed: t('marketplace.writeoffDetailsDialog.event.writeoffCompleted'),
};
const LOG_TYPES: Record<string, ActivityEventType> = {
  draft_created: 'create',
  draft_updated: 'update',
  submitted_to_council: 'transfer',
  authorized_by_council: 'sign',
  declined_by_council: 'reject',
  confirmed_by_branch: 'sign',
  execution_started: 'system',
  item_executed: 'system',
  execution_completed: 'sign',
};

const title = computed(() => proposalTitle(props.proposal));

// Журнал → канонический ActivityTimeline (новые события сверху).
type WriteoffProposalItem = MarketplaceWriteoffProposalView['items'][number];

const itemColumns: BaseTableColumn<WriteoffProposalItem>[] = [
  { key: 'branch', label: t('marketplace.writeoffDetailsDialog.column.issuancePoint'), width: '220px' },
  { key: 'asset', label: t('marketplace.writeoffDetailsDialog.column.name'), width: '260px', field: 'asset_title' },
  { key: 'quantity', label: t('marketplace.writeoffDetailsDialog.column.quantity'), width: '130px', numeric: true },
  { key: 'amount', label: t('marketplace.writeoffDetailsDialog.column.amount'), width: '130px', numeric: true },
  { key: 'reason', label: t('marketplace.writeoffDetailsDialog.column.reason'), width: '240px', field: 'reason' },
  { key: 'status', label: t('marketplace.writeoffDetailsDialog.column.status'), width: '140px' },
];

/** У позиции проекта своего идентификатора нет — ключ собираем из участка и товара. */
function itemRowKey(item: WriteoffProposalItem): string {
  return `${item.braname}:${item.asset_title}:${item.reason}`;
}

const journalEvents = computed<ActivityEvent[]>(() =>
  (props.proposal.decision_log ?? []).map((entry, idx) => ({
    id: String(idx),
    type: LOG_TYPES[entry.action] ?? 'system',
    title: LOG_LABELS[entry.action] ?? entry.action,
    date: entry.at,
  })),
);
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  :title="`${title} · ${humanStatus(proposal.status)}`",
  maximized,
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  .writeoff-details
    BaseCard(:title="$t('marketplace.writeoffDetailsDialog.mainInfoTitle')")
      DataRow(:label="$t('marketplace.writeoffDetailsDialog.cycleLabel')", :value="fmtDate(proposal.cycle_started_at)")
      DataRow(:label="$t('marketplace.writeoffDetailsDialog.itemsCountLabel')", :value="positionsLabel(proposal.items.length)")
      DataRow(:label="$t('marketplace.writeoffDetailsDialog.totalAmountLabel')", :value="formatAsset2Digits(proposal.total_amount)")
      DataRow(:label="$t('marketplace.writeoffDetailsDialog.decisionLabel')", :value="councilOutcome(proposal.status)")

    BaseCard(:title="$t('marketplace.writeoffDetailsDialog.itemsListTitle')")
      BaseTable(
        :columns="itemColumns",
        :rows="proposal.items",
        :row-key="itemRowKey",
        min-width="900px"
      )
        template(#cell-branch="{ row }")
          | {{ row.branch_name || row.braname }}
        template(#cell-quantity="{ row }")
          | {{ itemQuantityLabel(row) }}
        template(#cell-amount="{ row }")
          | {{ formatAsset2Digits(row.amount) }}
        template(#cell-status="{ row }")
          BaseBadge(:variant="row.executed ? 'pos' : 'neutral'") {{ row.executed ? $t('marketplace.writeoffDetailsDialog.itemStatusDone') : $t('marketplace.writeoffDetailsDialog.itemStatusPending') }}

    BaseCard(v-if="proposal.reject_reason", :title="$t('marketplace.writeoffDetailsDialog.rejectReasonTitle')")
      .text-body2 {{ proposal.reject_reason }}

    BaseCard(v-if="journalEvents.length", :title="$t('marketplace.writeoffDetailsDialog.historyTitle')")
      ActivityTimeline(:events="journalEvents", :group-by-date="true")
</template>

<style lang="scss" scoped>
// Контент детального экрана — центрированная колонка фиксированной ширины
// (как страница раздела), а не full-bleed на весь maximized-экран; секции —
// канон-карточки BaseCard со встроенными заголовками, между ними — единый
// вертикальный ритм.
.writeoff-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  max-width: 920px;
  margin: 0 auto;
  padding: var(--p-2, 8px) 0 var(--p-6, 24px);
}
</style>
