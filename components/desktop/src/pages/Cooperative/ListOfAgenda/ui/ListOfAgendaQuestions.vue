<template lang="pug">
.agenda-page
  QuestionsTable(
    :decisions='decisions',
    :loading='loading',
    :isChairman='session.isChairman',
    :format-decision-title='formatDecisionTitle',
    :is-voted-for='isVotedFor',
    :is-voted-against='isVotedAgainst',
    :is-voted-any='isVotedAny',
    :processing-decisions='processingDecisions',
    @authorize='onAuthorizeDecision',
    @decline='onDeclineDecision',
    @vote-for='onVoteFor',
    @vote-against='onVoteAgainst'
  )
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { CreateProjectButton } from 'src/features/Decision/CreateProject';
import { RefreshAgendaButton } from 'src/features/Decision/RefreshAgenda';
import { useAgendaBoard } from 'src/processes/process-decisions/agenda-board';
import { QuestionsTable } from 'src/widgets/Questions';
import { useHeaderActions } from 'src/shared/hooks';

const session = useSessionStore();

// Инжектим кнопки повестки в заголовок: обновление слева от создания решения.
const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({
    id: 'refresh-agenda',
    component: RefreshAgendaButton,
    order: 0,
  });
  registerAction({
    id: 'create-project',
    component: CreateProjectButton,
    order: 1,
  });
});

// Вопросы, их живое обновление и действия совета — общие со страницей вопроса.
// realtime: живое обновление повестки по таблицам решений и состава совета — в useAgendaBoard
const {
  decisions,
  loading,
  processingDecisions,
  isVotedFor,
  isVotedAgainst,
  isVotedAny,
  formatDecisionTitle,
  onAuthorizeDecision,
  onDeclineDecision,
  onVoteFor,
  onVoteAgainst,
  load,
} = useAgendaBoard();

void load();

// Опроса по таймеру здесь нет: один ответ повестки — пакет документов по
// каждому решению (около 200 КБ), и перечитывать его раз в 10 секунд незачем
// (C28-41). Список перечитывается только по факту изменения — ленте цепи, —
// после своего действия и по кнопке «Обновить» в шапке (C28-83).
</script>

<style lang="scss" scoped>
/* Полная ширина контента, как на canon-страницах документов/собраний. */
.agenda-page {
  padding: var(--p-6, 24px);
}
@media (max-width: 768px) {
  .agenda-page {
    padding: var(--p-4, 16px);
  }
}
</style>
