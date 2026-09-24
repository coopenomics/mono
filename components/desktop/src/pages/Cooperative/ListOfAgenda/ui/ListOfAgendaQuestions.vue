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
import { computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { CreateProjectButton } from 'src/features/Decision/CreateProject';
import { RefreshAgendaButton } from 'src/features/Decision/RefreshAgenda';
import { useAgendaStore } from 'src/entities/Agenda/model';
import { useDecisionProcessor } from 'src/processes/process-decisions';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { QuestionsTable } from 'src/widgets/Questions';
import { useHeaderActions } from 'src/shared/hooks';
import { t } from 'src/shared/i18n';
import { SovietContract } from 'cooptypes';
import { useLiveReload, liveTable } from 'src/shared/lib/realtime';

const route = useRoute();
const session = useSessionStore();

const processingDecisions = ref<Record<number, boolean>>({});

// Реактивно проставляет/снимает состояние загрузки по пункту повестки
// (замена ручному мутированию + setTimeout-хаку для триггера реактивности).
const setProcessing = (decision_id: number, value: boolean) => {
  processingDecisions.value = {
    ...processingDecisions.value,
    [decision_id]: value,
  };
};

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

// Получаем процесс обработки решений
const decisionProcessor = useDecisionProcessor();
const {
  loading,
  loadDecisions,
  authorizeAndExecuteDecision,
  declineDecision,
  voteForDecision,
  voteAgainstDecision,
  isVotedFor,
  isVotedAgainst,
  isVotedAny,
  formatDecisionTitle,
} = decisionProcessor;

// Данные. Ответ мутации приходит, когда узел разобрал её блок, поэтому
// перечитанная после действия повестка уже без утверждённого пункта.
const decisions = computed(() => decisionProcessor.decisions.value);

// Дозагрузка повестки после действия пайщика. Guard от наложения и проглатывание
// ошибки — внутри store.refresh: то же самое делает кнопка «Обновить» в шапке,
// а она рендерится вне дерева страницы и обязана делить состояние с этой
// дозагрузкой. Ошибка обновления сознательно не всплывает пайщику: список —
// фоновая вещь, и его падение не означает, что голос не прошёл.
const agendaStore = useAgendaStore();
const refreshAgendaQuietly = () =>
  agendaStore.refresh({ coopname: route.params.coopname as string });

// Живая повестка: голос любого члена совета, новый вопрос, утверждение или
// отклонение меняют soviet::decisions, смена состава совета — soviet::boards.
// Узел сообщает об этом по ленте изменений, и список перечитывается сам.
const live = useLiveReload(
  [
    liveTable(SovietContract, SovietContract.Tables.Decisions),
    liveTable(SovietContract, SovietContract.Tables.Boards),
  ],
  refreshAgendaQuietly,
);

// Обработчики событий
const onAuthorizeDecision = async (row) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await authorizeAndExecuteDecision(row);
  } catch (e) {
    FailAlert(e);
    setProcessing(decision_id, false);
    return;
  }

  SuccessAlert(t('cooperative.listOfAgendaQuestions.approvedSuccess'));
  setProcessing(decision_id, false);
  await live.refresh();
};

const onDeclineDecision = async (row) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await declineDecision(row);
  } catch (e) {
    FailAlert(e);
    setProcessing(decision_id, false);
    return;
  }

  // Отклонённое решение стирается контрактом — тихо перечитываем.
  SuccessAlert(t('cooperative.listOfAgendaQuestions.rejectedSuccess'));
  setProcessing(decision_id, false);
  await live.refresh();
};

// Голос «за»/«против» отличается только вызовом фичи — остальное общее.
const submitVote = async (row, cast: typeof voteForDecision) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await cast(row);
  } catch (e) {
    console.error(e);
    FailAlert(e);
    setProcessing(decision_id, false);
    return;
  }

  // Голос НЕ убирает пункт из повестки — он остаётся неутверждённым, лишь
  // помечается отметкой голоса. Обновляем список тихо (без скелетонов).
  // Голос уже в цепи — «Утвердить» доступно сразу после ответа.
  SuccessAlert(t('cooperative.listOfAgendaQuestions.voteAcceptedSuccess'));
  await live.refresh();
  setProcessing(decision_id, false);
};

const onVoteFor = (row) => submitVote(row, voteForDecision);
const onVoteAgainst = (row) => submitVote(row, voteAgainstDecision);

// Инициализация
loadDecisions(route.params.coopname as string);

// Опроса по таймеру здесь нет: один ответ повестки — пакет документов по
// каждому решению (около 200 КБ), и перечитывать его раз в 10 секунд незачем
// (C28-41). Список перечитывается только по факту изменения — ленте выше, —
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
