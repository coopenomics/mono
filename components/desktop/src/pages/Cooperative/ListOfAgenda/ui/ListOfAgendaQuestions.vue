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

// Пункты, которые председатель только что УТВЕРДИЛ. Повестка показывает все
// неутверждённые вопросы, поэтому скрывать пункт нужно только после утверждения
// (не после голосования — там пункт остаётся, лишь помечается голос). После
// утверждения пункт исполняется и уходит из повестки, но данные из блокчейна
// доходят с задержкой — обновление успевало на мгновение вернуть уже
// утверждённый пункт («исчез → вернулся → исчез»). Держим его скрытым; в пределах
// сессии страницы обратно не показываем — намеренно просто.
const actedDecisionIds = ref<Set<number>>(new Set());

// Данные
const decisions = computed(() =>
  decisionProcessor.decisions.value.filter(
    (row) => !actedDecisionIds.value.has(Number(row.table?.id)),
  ),
);

// Дозагрузка повестки после действия пайщика. Guard от наложения и проглатывание
// ошибки — внутри store.refresh: то же самое делает кнопка «Обновить» в шапке,
// а она рендерится вне дерева страницы и обязана делить состояние с этой
// дозагрузкой. Ошибка обновления сознательно не всплывает пайщику: список —
// фоновая вещь, и его падение не означает, что голос не прошёл.
const agendaStore = useAgendaStore();
const refreshAgendaQuietly = () =>
  agendaStore.refresh({ coopname: route.params.coopname as string });

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
  await refreshAgendaQuietly();
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
  await refreshAgendaQuietly();
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
  await refreshAgendaQuietly();

  // Держим загрузку ещё VOTE_SETTLE_MS, чтобы «Утвердить» нельзя было нажать
  // до того, как бэкенд учтёт голос (иначе утверждение упадёт с ошибкой).
  setTimeout(() => setProcessing(decision_id, false), VOTE_SETTLE_MS);
};

const onVoteFor = (row) => submitVote(row, voteForDecision);
const onVoteAgainst = (row) => submitVote(row, voteAgainstDecision);

// Инициализация
loadDecisions(route.params.coopname as string);

// Периодического обновления здесь НЕТ намеренно. Один ответ повестки — это
// пакет документов по каждому решению (заявление вместе с положением ЦПП,
// правилами электронной подписи и прочими: 4–5 документов по ~50 КБ, за 200 КБ
// суммарно), и перечитывать его таймером раз в 10 секунд в открытой вкладке
// незачем. Список обновляется тремя способами: при заходе на страницу, сам
// после действия пайщика и по кнопке «Обновить» в шапке.
//
// Плата за это: голоса других членов совета, поданные прямо сейчас, появятся не
// сами — нужно нажать «Обновить». Осознанный размен (C28-41).
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
