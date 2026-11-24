<template lang="pug">
//- Результаты голосования по вопросам повестки. Протокол — документ собрания,
//- он стоит в «Документах» в колонке сведений, а не здесь.
section.meet-results
  .meet-results__head {{ $t('meet.meetDetailsResults.title') }}

  ol.meet-results__items
    MeetQuestion(
      v-for='(item, index) in items',
      :key='index',
      :number='index + 1',
      :question='item'
    )
      .meet-tally
        BaseBadge(v-if='item.accepted !== null', :variant='item.accepted ? "pos" : "neg"')
          | {{ item.accepted ? $t('meet.meetDetailsResults.accepted') : $t('meet.meetDetailsResults.rejected') }}
        span.meet-tally__item
          span.meet-tally__label {{ $t('meet.meetDetailsResults.forLabel') }}
          span.meet-tally__value {{ item.votesFor }}
        span.meet-tally__item
          span.meet-tally__label {{ $t('meet.meetDetailsResults.againstLabel') }}
          span.meet-tally__value {{ item.votesAgainst }}
        span.meet-tally__item
          span.meet-tally__label {{ $t('meet.meetDetailsResults.abstainedLabel') }}
          span.meet-tally__value {{ item.votesAbstained }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IMeet } from 'src/entities/Meet';
import { BaseBadge } from 'src/shared/ui/base';
import { MeetQuestion } from 'src/widgets/Meets/MeetQuestion';

const props = defineProps<{
  meet: IMeet;
}>();

interface ResultItem {
  title: string;
  context: string | null;
  decision: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstained: number;
  /** Итог по протоколу; до утверждения протокола — пусто, показывается только счёт. */
  accepted: boolean | null;
}

// После утверждения протокола — итоги из протокола; до него — счёт голосов из
// вопросов собрания в цепи, без вывода «принято»: его фиксирует протокол.
const items = computed<ResultItem[]>(() => {
  const processed = props.meet?.processed?.results;
  if (processed?.length)
    return processed.map((r) => ({
      title: r.title ?? '',
      context: r.context ?? null,
      decision: r.decision ?? '',
      votesFor: Number(r.votes_for ?? 0),
      votesAgainst: Number(r.votes_against ?? 0),
      votesAbstained: Number(r.votes_abstained ?? 0),
      accepted: r.accepted ?? null,
    }));
  return (props.meet?.processing?.questions ?? []).map((q) => ({
    title: q.title ?? '',
    context: q.context ?? null,
    decision: q.decision ?? '',
    votesFor: Number(q.counter_votes_for ?? 0),
    votesAgainst: Number(q.counter_votes_against ?? 0),
    votesAbstained: Number(q.counter_votes_abstained ?? 0),
    accepted: null,
  }));
});
</script>

<style lang="scss" scoped>
.meet-results {
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
}

.meet-results__head {
  margin-bottom: var(--p-4, 16px);
  font-size: var(--p-fs-h2, 18px);
  font-weight: 700;
  color: var(--p-ink);
}

.meet-results__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

// Итог вопроса одной строкой: бейдж решения и счёт голосов.
.meet-tally {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2, 8px) var(--p-5, 20px);
}

.meet-tally__item {
  display: inline-flex;
  align-items: baseline;
  gap: var(--p-2, 8px);
}

.meet-tally__label {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}

.meet-tally__value {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}
</style>
