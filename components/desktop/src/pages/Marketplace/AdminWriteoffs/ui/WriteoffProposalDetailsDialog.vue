<script lang="ts" setup>
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseDialog } from 'src/shared/ui/base';
import type { MarketplaceWriteoffProposalView } from '../api';

defineProps<{
  modelValue: boolean;
  proposal: MarketplaceWriteoffProposalView;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
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
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue",
  :title="`Проект списания · ${humanStatus(proposal.status)}`",
  maximized,
  @update:model-value="(v) => emit('update:modelValue', v)"
)
  section
    .t-h3 Основные параметры
    .row.q-col-gutter-md.q-mt-xs
      .col
        .t-muted Цикл
        div {{ fmt(proposal.cycle_started_at) }}
      .col
        .t-muted Сумма
        div {{ formatAsset2Digits(proposal.total_amount) }}
      .col
        .t-muted Идентификатор on-chain
        .t-mono-sm(style="word-break: break-all") {{ proposal.proposal_hash || '—' }}
      .col
        .t-muted Решение совета
        div {{ proposal.decision_id ?? '—' }}

  section.q-mt-md
    .t-h3.q-mb-sm Позиции
    q-markup-table(dense, flat, bordered)
      thead
        tr
          th №
          th Кооп. участок
          th Наименование
          th Кол-во
          th Сумма
          th Причина
          th Статус
      tbody
        tr(v-for="(it, idx) in proposal.items", :key="idx")
          td {{ idx + 1 }}
          td {{ it.branch_name || it.braname }}
          td {{ it.asset_title }}
          td {{ it.quantity }}
          td {{ formatAsset2Digits(it.amount) }}
          td {{ it.reason }}
          td(:class="it.executed ? 'text-positive' : 'text-grey-7'") {{ it.executed ? 'Исполнено' : 'Ожидает' }}

  section.q-mt-md(v-if="proposal.reject_reason")
    .t-h3 Причина отказа совета
    .text-body2 {{ proposal.reject_reason }}

  section.q-mt-md(v-if="proposal.decision_log && proposal.decision_log.length")
    .t-h3.q-mb-sm Журнал решений
    q-list(dense, bordered, separator)
      q-item(v-for="(entry, idx) in proposal.decision_log", :key="idx")
        q-item-section
          q-item-label {{ entry.action }} — {{ entry.actor }}
          q-item-label(caption) {{ fmt(entry.at) }}
</template>
