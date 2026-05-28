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
    @vote-for='onVoteFor',
    @vote-against='onVoteAgainst'
  )
</template>

<script setup lang="ts">
import { onBeforeUnmount, computed, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { CreateProjectButton } from 'src/features/Decision/CreateProject';
import { useDecisionProcessor } from 'src/processes/process-decisions';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { QuestionsTable } from 'src/widgets/Questions';
import { useHeaderActions } from 'src/shared/hooks';

const route = useRoute();
const session = useSessionStore();

const processingDecisions = ref<Record<number, boolean>>({});

// После голоса бэкенду нужно несколько секунд, чтобы учесть голос из блокчейна.
// Если нажать «Утвердить» сразу — утверждение упадёт с ошибкой «голос ещё не
// учтён». Поэтому после успешного голоса держим кнопки строки (в т.ч.
// «Утвердить») в состоянии загрузки ещё столько миллисекунд.
const VOTE_SETTLE_MS = 3000;

// Реактивно проставляет/снимает состояние загрузки по пункту повестки
// (замена ручному мутированию + setTimeout-хаку для триггера реактивности).
const setProcessing = (decision_id: number, value: boolean) => {
  processingDecisions.value = {
    ...processingDecisions.value,
    [decision_id]: value,
  };
};

// Инжектим кнопку создания решения в заголовок
const { registerAction } = useHeaderActions();

onMounted(() => {
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
  voteForDecision,
  voteAgainstDecision,
  isVotedFor,
  isVotedAgainst,
  isVotedAny,
  formatDecisionTitle,
} = decisionProcessor;

// Пункты, которые председатель только что УТВЕРДИЛ. Повестка показывает все
// неутверждённые вопросы, поэтому скрывать пункт нужно только после утверждения
// (не после голосования — там пункт остаётся, лишь помечается голос). После
// утверждения пункт исполняется и уходит из повестки, но данные из блокчейна
// доходят с задержкой — поллинг успевал на мгновение вернуть уже утверждённый
// пункт («исчез → вернулся → исчез»). Держим его скрытым локально; в пределах
// сессии страницы обратно не показываем — намеренно просто.
const actedDecisionIds = ref<Set<number>>(new Set());

// Данные
const decisions = computed(() =>
  decisionProcessor.decisions.value.filter(
    (row) => !actedDecisionIds.value.has(Number(row.table?.id)),
  ),
);

// Обработчики событий
const onAuthorizeDecision = async (row) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await authorizeAndExecuteDecision(row);
    // Оптимистично прячем пункт и обновляем список тихо (без скелетонов).
    actedDecisionIds.value.add(decision_id);
    SuccessAlert('Решение принято и исполнено');
    await loadDecisions(route.params.coopname as string, true);
  } catch (e) {
    FailAlert(e);
  } finally {
    setProcessing(decision_id, false);
  }
};

const onVoteFor = async (row) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await voteForDecision(row);
    // Голос НЕ убирает пункт из повестки — он остаётся неутверждённым, лишь
    // помечается отметкой голоса. Обновляем список тихо (без скелетонов).
    SuccessAlert('Голос принят');
    await loadDecisions(route.params.coopname as string, true);
    // Держим загрузку ещё VOTE_SETTLE_MS, чтобы «Утвердить» нельзя было нажать
    // до того, как бэкенд учтёт голос (иначе утверждение упадёт с ошибкой).
    setTimeout(() => setProcessing(decision_id, false), VOTE_SETTLE_MS);
  } catch (e) {
    console.error(e)
    FailAlert(e);
    setProcessing(decision_id, false);
  }
};

const onVoteAgainst = async (row) => {
  const decision_id = Number(row.table.id);
  setProcessing(decision_id, true);

  try {
    await voteAgainstDecision(row);
    // Голос НЕ убирает пункт из повестки — он остаётся неутверждённым, лишь
    // помечается отметкой голоса. Обновляем список тихо (без скелетонов).
    SuccessAlert('Голос принят');
    await loadDecisions(route.params.coopname as string, true);
    // Держим загрузку ещё VOTE_SETTLE_MS, чтобы «Утвердить» нельзя было нажать
    // до того, как бэкенд учтёт голос (иначе утверждение упадёт с ошибкой).
    setTimeout(() => setProcessing(decision_id, false), VOTE_SETTLE_MS);
  } catch (e) {
    console.error(e)
    FailAlert(e);
    setProcessing(decision_id, false);
  }
};

// Инициализация
loadDecisions(route.params.coopname as string);

// Периодическое обновление данных
const interval = setInterval(
  () => loadDecisions(route.params.coopname as string, true),
  10000,
);
onBeforeUnmount(() => clearInterval(interval));
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
