<template lang="pug">
.agenda-question-page
  CardListSkeleton(v-if='firstLoad', :count='1')

  //- Вопроса в повестке нет: совет его уже решил либо срок вопроса вышел.
  EmptyState(
    v-else-if='!question',
    :title='$t("cooperative.agendaQuestionPage.goneTitle", { id: questionId })',
    :body='$t("cooperative.agendaQuestionPage.goneBody")'
  )
    template(#icon)
      q-icon(name='how_to_vote', size='48px')
    template(#action)
      BaseButton.q-mt-md(variant='secondary', @click='goBack') {{ $t('cooperative.agendaQuestionPage.backToAgenda') }}

  //- Вопрос на белой подложке во всю ширину: сведения, документы, голосование и утверждение.
  BaseCard(v-else, variant='default')
    .agenda-question-page__crumb
      BackLink(:label='$t("cooperative.agendaQuestionPage.backToAgenda")', @click='goBack')
    .agenda-question-page__head
      .agenda-question-page__title {{ $t('questions.questionCard.detailsTitle', { id: question.table.id }) }}
      .agenda-question-page__expires {{ $t('questions.questionCard.expiresIn', { fromNow: formatToFromNow(question.table.expired_at) }) }}

    QuestionDetails(:agenda='question')

    .agenda-question-page__footer
      VotingButtons(
        :decision='question.table',
        :is-rejected='isQuestionRejected(question)',
        :is-voted-for='isVotedFor',
        :is-voted-against='isVotedAgainst',
        :is-voted-any='isVotedAny',
        @vote-for='onVoteFor(question)',
        @vote-against='onVoteAgainst(question)'
      )
      ChairmanDecisionButton(
        :agenda='question',
        :is-processing='isProcessing(question.table.id)',
        @authorize='onAuthorizeDecision(question)',
        @decline='onDeclineDecision(question)'
      )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFirstLoad } from 'src/shared/lib/composables';
import { formatToFromNow } from 'src/shared/lib/utils/dates/formatToFromNow';
import { BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { BackLink } from 'src/shared/ui/domain';
import { useAgendaBoard } from 'src/processes/process-decisions/agenda-board';
import { ChairmanDecisionButton, QuestionDetails, VotingButtons, isQuestionRejected } from 'src/widgets/Questions';

/**
 * Отдельная страница вопроса повестки совета. У вопроса свой адрес: на него
 * ведут кнопка «Открыть страницу» в панели вопроса и оповещение членам совета.
 * Данные и действия — те же, что у списка повестки.
 */
const route = useRoute();
const router = useRouter();

const { decisions, loading, isProcessing, isVotedFor, isVotedAgainst, isVotedAny, onAuthorizeDecision, onDeclineDecision, onVoteFor, onVoteAgainst, load } = useAgendaBoard();
const firstLoad = useFirstLoad(loading);

const questionId = computed(() => String(route.params.id ?? ''));
const question = computed(() => decisions.value.find((d) => String(d.table.id) === questionId.value) ?? null);

function goBack(): void {
  void router.push({ name: 'agenda', params: { coopname: route.params.coopname } });
}

void load();
</script>

<style scoped>
/* Отступы страницы — как у списка повестки. */
.agenda-question-page {
  padding: var(--p-6);
}
.agenda-question-page__crumb {
  margin-bottom: var(--p-3);
  font-size: var(--p-fs-body-sm);
}
.agenda-question-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-2) var(--p-4);
  margin-bottom: var(--p-5);
}
.agenda-question-page__title {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  font-weight: 600;
  color: var(--p-ink);
}
.agenda-question-page__expires {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
  white-space: nowrap;
}
/* Голосование слева, действие председателя справа — как в подвале панели вопроса. */
.agenda-question-page__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
@media (max-width: 768px) {
  .agenda-question-page {
    padding: var(--p-4);
  }
}
</style>
