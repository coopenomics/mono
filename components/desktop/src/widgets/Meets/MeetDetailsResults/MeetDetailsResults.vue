<template lang="pug">
.meet-results
  .meet-results__card
    .meet-results__head
      q-icon(name='fact_check', size='18px')
      span.meet-results__title Результаты

    .meet-results__items
      .meet-result-card(
        v-for='(item, index) in meetAgendaItems',
        :key='index'
      )
        .meet-result-card__head
          AgendaNumberAvatar(:number='item.number')
          span.meet-result-card__title {{ item.title }}

        .meet-result-card__context(
          v-if='item.context',
          v-html='parseLinks(item.context)'
        )

        .meet-result-card__outcome
          .meet-result-card__outcome-row
            span.meet-result-card__outcome-label Решение
            span.outcome-chip(:class='getOutcomeChipClass(item)')
              q-icon(:name='getResultIcon(item)', size='14px')
              span {{ getResultText(item) }}
          .meet-result-card__decision(v-if='item.decision') {{ item.decision }}

        .meet-result-card__votes
          .vote-stat.vote-stat--for
            span.vote-stat__label За
            span.vote-stat__value {{ item.votes_for }}
          .vote-stat.vote-stat--against
            span.vote-stat__label Против
            span.vote-stat__value {{ item.votes_against }}
          .vote-stat.vote-stat--neutral
            span.vote-stat__label Воздержались
            span.vote-stat__value {{ item.votes_abstained }}

  ExpandableDocument.meet-results__protocol(
    v-if='protocolDocumentAggregate',
    :documentAggregate='protocolDocumentAggregate',
    title='Протокол решения общего собрания пайщиков'
  )
</template>

<script setup lang="ts">
import type { IMeet } from 'src/entities/Meet';
import { computed } from 'vue';
import { ExpandableDocument } from 'src/shared/ui';
import { AgendaNumberAvatar } from 'src/shared/ui/AgendaNumberAvatar';
import { parseLinks } from 'src/shared/lib/utils';

const props = defineProps<{
  meet: IMeet;
}>();

const meetAgendaItems = computed(() => {
  if (!props.meet || !props.meet.processed?.results) return [];
  return props.meet.processed.results || [];
});

const protocolDocumentAggregate = computed(
  () => props.meet?.processed?.decisionAggregate ?? null,
);

const getResultText = (question: any) => {
  if (question.accepted === undefined) return 'Нет данных';
  return question.accepted ? 'Принято' : 'Отклонено';
};

const getResultIcon = (question: any) => {
  if (question.accepted === undefined) return 'help_outline';
  return question.accepted ? 'check_circle' : 'cancel';
};

const getOutcomeChipClass = (question: any) => {
  if (question.accepted === undefined) return 'outcome-chip--unknown';
  return question.accepted ? 'outcome-chip--pos' : 'outcome-chip--neg';
};
</script>

<style lang="scss" scoped>
.meet-results__card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
}

.meet-results__head {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink-2);
  margin-bottom: var(--p-4, 16px);
}
.meet-results__title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

.meet-results__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.meet-result-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.meet-result-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
}
.meet-result-card__title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink-1);
  padding-top: 6px;
  overflow-wrap: anywhere;
}
.meet-result-card__context {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
  color: var(--p-ink-2);
  overflow-wrap: anywhere;

  :deep(a) {
    color: var(--p-primary);
    word-break: break-word;
  }
}

.meet-result-card__outcome {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface-2);
}
.meet-result-card__outcome-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
}
.meet-result-card__outcome-label {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.meet-result-card__decision {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.45;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}

/* Итог решения — спокойный токен-чип */
.outcome-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: var(--p-fs-meta, 12px);
  font-weight: 600;
}
.outcome-chip--pos {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.outcome-chip--neg {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}
.outcome-chip--unknown {
  background: var(--p-surface-2);
  color: var(--p-ink-2);
}

.meet-result-card__votes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--p-2, 8px);
}
@media (max-width: 599px) {
  .meet-result-card__votes {
    grid-template-columns: 1fr;
  }
}
.vote-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--p-3, 12px);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface-2);
  text-align: center;
}
.vote-stat--for {
  background: var(--p-pos-soft);
}
.vote-stat--against {
  background: var(--p-neg-soft);
}
.vote-stat__label {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--p-ink-2);
}
.vote-stat__value {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--p-ink);
}

.meet-results__protocol {
  display: block;
  margin-top: var(--p-5, 20px);
}
</style>
