<script lang="ts" setup>
import { computed } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseDialog, BaseBadge } from 'src/shared/ui/base';
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

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function humanStatus(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Черновик';
    case 'ON_AGENDA':
      return 'На повестке совета';
    case 'AUTHORIZED':
      return 'Утверждено советом';
    case 'PENDING_CONFIRMATION':
      return 'Ожидает подтверждения склада';
    case 'EXECUTING':
      return 'Идёт списание';
    case 'EXECUTED':
      return 'Исполнено';
    case 'REJECTED':
      return 'Отклонено';
    default:
      return String(status);
  }
}

// Итог рассмотрения советом — человеку, не служебный номер решения.
function councilOutcome(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Не вынесено';
    case 'ON_AGENDA':
      return 'На рассмотрении';
    case 'REJECTED':
      return 'Отклонено советом';
    default:
      return 'Одобрено советом';
  }
}

// Журнал решений — коды действий в человеческие формулировки + тип события
// для канонического таймлайна (иконка/цвет берутся из типа).
const LOG_LABELS: Record<string, string> = {
  draft_created: 'Черновик создан',
  draft_updated: 'Состав изменён',
  submitted_to_council: 'Отправлено в совет',
  authorized_by_council: 'Совет одобрил',
  declined_by_council: 'Совет отклонил',
  confirmed_by_branch: 'Подтверждено складом',
  execution_started: 'Списание начато',
  item_executed: 'Позиция списана',
  execution_completed: 'Списание завершено',
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
  section.writeoff-details
    .t-h3 Основные параметры
    .writeoff-details__grid.q-mt-sm
      .writeoff-details__field
        .t-muted Цикл списания
        div {{ fmtDate(proposal.cycle_started_at) }}
      .writeoff-details__field
        .t-muted Позиций
        div {{ positionsLabel(proposal.items.length) }}
      .writeoff-details__field
        .t-muted Сумма списания
        div {{ formatAsset2Digits(proposal.total_amount) }}
      .writeoff-details__field
        .t-muted Решение совета
        div {{ councilOutcome(proposal.status) }}

  section.writeoff-details.q-mt-lg
    .t-h3.q-mb-sm Позиции к списанию
    .table-wrap
      .table-scroll
        table.table
          thead
            tr
              th №
              th Кооп. участок
              th Наименование
              th.col-num Кол-во
              th.col-num Сумма
              th Причина
              th Статус
          tbody
            tr(v-for="(it, idx) in proposal.items", :key="idx")
              td {{ idx + 1 }}
              td {{ it.branch_name || it.braname }}
              td {{ it.asset_title }}
              td.col-num {{ it.quantity }}
              td.col-num {{ formatAsset2Digits(it.amount) }}
              td {{ it.reason }}
              td
                BaseBadge(:variant="it.executed ? 'pos' : 'neutral'") {{ it.executed ? 'Списано' : 'Ожидает' }}

  section.writeoff-details.q-mt-lg(v-if="proposal.reject_reason")
    .t-h3.q-mb-sm Причина отказа совета
    .text-body2 {{ proposal.reject_reason }}

  section.writeoff-details.q-mt-lg(v-if="journalEvents.length")
    .t-h3.q-mb-sm Журнал решений
    ActivityTimeline(:events="journalEvents", :group-by-date="true")
</template>

<style lang="scss" scoped>
.writeoff-details {
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--p-4, 16px);
  }
}
</style>
