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
  declineDecision,
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

// Фоновое обновление повестки — общая точка для поллинга и для дозагрузки
// после действия. Три свойства, которых не было у прямого вызова loadDecisions:
//
// 1. Ошибка НЕ всплывает пользователю. Обновление списка — фоновая операция;
//    её падение не означает, что действие не состоялось. Раньше таймаут этого
//    запроса показывался красным тостом сразу после «Голос принят» — голос при
//    этом уже лежал в цепи.
// 2. Guard от наложения: пока предыдущий запрос в полёте, тик пропускаем.
//    setInterval без guard'а на медленном канале копит запросы, а они выедают
//    лимит одновременных соединений браузера (6 на origin по HTTP/1.1) — тот же
//    лимит делят вызовы цепи, поэтому затор бьёт по голосованию.
// 3. Во вкладке в фоне не опрашиваем вовсе — обновлять невидимый список незачем.
let refreshInFlight = false;
const refreshAgendaQuietly = async (force = false) => {
  if (refreshInFlight) return;
  if (!force && typeof document !== 'undefined' && document.hidden) return;

  refreshInFlight = true;
  try {
    await loadDecisions(route.params.coopname as string, true);
  } catch (e) {
    console.error('[agenda] фоновое обновление повестки не удалось', e);
  } finally {
    refreshInFlight = false;
  }
};

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

  // Оптимистично прячем пункт и обновляем список тихо (без скелетонов).
  actedDecisionIds.value.add(decision_id);
  SuccessAlert('Решение принято и исполнено');
  setProcessing(decision_id, false);
  await refreshAgendaQuietly(true);
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

  // Отклонённое решение стирается контрактом — прячем пункт и тихо обновляем.
  actedDecisionIds.value.add(decision_id);
  SuccessAlert('Решение отклонено');
  setProcessing(decision_id, false);
  await refreshAgendaQuietly(true);
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
  SuccessAlert('Голос принят');
  await refreshAgendaQuietly(true);

  // Держим загрузку ещё VOTE_SETTLE_MS, чтобы «Утвердить» нельзя было нажать
  // до того, как бэкенд учтёт голос (иначе утверждение упадёт с ошибкой).
  setTimeout(() => setProcessing(decision_id, false), VOTE_SETTLE_MS);
};

const onVoteFor = (row) => submitVote(row, voteForDecision);
const onVoteAgainst = (row) => submitVote(row, voteAgainstDecision);

// Инициализация
loadDecisions(route.params.coopname as string);

// Периодическое обновление данных
const interval = setInterval(() => void refreshAgendaQuietly(), 10000);
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
