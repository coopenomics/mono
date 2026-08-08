<script lang="ts" setup>
import { computed } from 'vue';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { BaseDialog, BaseBadge, BaseCard } from 'src/shared/ui/base';
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
  const saleUnit = marketplaceOrderSaleUnit(Number.parseFloat(it.quantity) || 0, it.unit_of_measure, it.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

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
  .writeoff-details
    BaseCard(title="Основные параметры")
      DataRow(label="Цикл списания", :value="fmtDate(proposal.cycle_started_at)")
      DataRow(label="Позиций", :value="positionsLabel(proposal.items.length)")
      DataRow(label="Сумма списания", :value="formatAsset2Digits(proposal.total_amount)")
      DataRow(label="Решение совета", :value="councilOutcome(proposal.status)")

    BaseCard(title="Позиции к списанию")
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
                td.col-num {{ itemQuantityLabel(it) }}
                td.col-num {{ formatAsset2Digits(it.amount) }}
                td {{ it.reason }}
                td
                  BaseBadge(:variant="it.executed ? 'pos' : 'neutral'") {{ it.executed ? 'Списано' : 'Ожидает' }}

    BaseCard(v-if="proposal.reject_reason", title="Причина отказа совета")
      .text-body2 {{ proposal.reject_reason }}

    BaseCard(v-if="journalEvents.length", title="Журнал решений")
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
