<script lang="ts" setup>
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
      return 'Авторизовано';
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
q-dialog(
  :model-value="modelValue"
  @update:model-value="(v) => emit('update:modelValue', v)"
  full-width
)
  q-card
    q-card-section.row.items-center
      .text-h6 Проект списания · {{ humanStatus(proposal.status) }}
      q-space
      q-btn(flat round icon="close" @click="emit('update:modelValue', false)")

    q-card-section
      .text-subtitle2 Основные параметры
      .row.q-col-gutter-md
        .col
          .text-caption.text-grey Цикл
          div {{ fmt(proposal.cycle_started_at) }}
        .col
          .text-caption.text-grey Сумма
          div {{ proposal.total_amount }}
        .col
          .text-caption.text-grey Идентификатор on-chain
          div(style="font-family: monospace; word-break: break-all") {{ proposal.proposal_hash || '—' }}
        .col
          .text-caption.text-grey Решение совета
          div {{ proposal.decision_id ?? '—' }}

    q-card-section
      .text-subtitle2.q-mb-sm Позиции
      q-markup-table(dense flat bordered)
        thead
          tr
            th №
            th КУ
            th Наименование
            th Кол-во
            th Сумма
            th Причина
            th Статус
        tbody
          tr(v-for="(it, idx) in proposal.items" :key="idx")
            td {{ idx + 1 }}
            td {{ it.braname }}
            td {{ it.asset_title }}
            td {{ it.quantity }}
            td {{ it.amount }}
            td {{ it.reason }}
            td(:class="it.executed ? 'text-positive' : 'text-grey-7'") {{ it.executed ? 'Исполнено' : 'Ожидает' }}

    q-card-section(v-if="proposal.reject_reason")
      .text-subtitle2 Причина отказа совета
      .text-body2 {{ proposal.reject_reason }}

    q-card-section(v-if="proposal.decision_log && proposal.decision_log.length")
      .text-subtitle2.q-mb-sm Журнал решений
      q-list(dense bordered separator)
        q-item(v-for="(entry, idx) in proposal.decision_log" :key="idx")
          q-item-section
            q-item-label {{ entry.action }} — {{ entry.actor }}
            q-item-label(caption) {{ fmt(entry.at) }}
</template>
