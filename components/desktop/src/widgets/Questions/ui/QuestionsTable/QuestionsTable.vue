<template lang="pug">
.questions-list
  slot(name='top')

  //- Скелетоны — только на ПЕРВОЙ загрузке (списка ещё нет). При фоновых
  //- обновлениях (голосование, поллинг) список уже показан и подменять его
  //- скелетонами нельзя — иначе вся страница «моргает».
  .questions-list__items(v-if='loading && !decisions.length')
    span.skel.questions-list__skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!decisions.length',
    title='Нет вопросов на повестке',
    body='Вопросы появляются автоматически при участии пайщиков в цифровых целевых потребительских программах кооператива. Добавить вопрос вручную можно кнопкой «Предложить повестку».'
  )
    template(#icon)
      q-icon(name='how_to_vote', size='48px')

  .questions-list__items(v-else)
    QuestionCard(
      v-for='row in decisions',
      :key='row.table.id',
      :agenda='row',
      :is-processing='isProcessing(row.table.id)',
      :is-voted-for='isVotedFor',
      :is-voted-against='isVotedAgainst',
      :is-voted-any='isVotedAny',
      @authorize='onAuthorizeDecision(row)',
      @decline='onDeclineDecision(row)',
      @vote-for='onVoteFor(row)',
      @vote-against='onVoteAgainst(row)'
    )
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import type { IAgenda } from 'src/entities/Agenda/model';
import { QuestionCard } from '../QuestionCard';

const props = defineProps({
  decisions: {
    type: Array as PropType<IAgenda[]>,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  isChairman: {
    type: Boolean,
    default: false,
  },
  formatDecisionTitle: {
    type: Function,
    required: false,
    default: undefined,
  },
  isVotedFor: {
    type: Function,
    required: true,
  },
  isVotedAgainst: {
    type: Function,
    required: true,
  },
  isVotedAny: {
    type: Function,
    required: true,
  },
  processingDecisions: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['authorize', 'decline', 'vote-for', 'vote-against']);

const isProcessing = (decisionId: number) => {
  return Boolean(props.processingDecisions[decisionId]);
};

const onAuthorizeDecision = (row: IAgenda) => {
  emit('authorize', row);
};

const onDeclineDecision = (row: IAgenda) => {
  emit('decline', row);
};

const onVoteFor = (row: IAgenda) => {
  emit('vote-for', row);
};

const onVoteAgainst = (row: IAgenda) => {
  emit('vote-against', row);
};
</script>

<style lang="scss" scoped>
.questions-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
.questions-list__skel {
  display: block;
  width: 100%;
  height: 88px;
  border-radius: var(--p-r-lg, 16px);
}
</style>
