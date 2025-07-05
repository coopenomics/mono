<template lang="pug">
q-card(flat)
  QuestionsTable(
    :decisions='decisions',
    :loading='loading',
    :isChairman='currentUser.isChairman',
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
import { useCurrentUser } from 'src/entities/Session';
import { CreateProjectButton } from 'src/features/Decision/CreateProject';
import { useDecisionProcessor } from 'src/processes/process-decisions';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { QuestionsTable } from 'src/widgets/Questions';
import { useHeaderActions } from 'src/shared/hooks';

const route = useRoute();
const currentUser = useCurrentUser();
const processingDecisions = ref<Record<number, boolean>>({});

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

// Данные
const decisions = computed(() => decisionProcessor.decisions.value);

// Обработчики событий
const onAuthorizeDecision = async (row) => {
  const decision_id = Number(row.table.id);
  processingDecisions.value[decision_id] = true;

  try {
    await authorizeAndExecuteDecision(row);
    SuccessAlert('Решение принято и исполнено');
    await loadDecisions(route.params.coopname as string);
  } catch (e) {
    FailAlert(e);
  } finally {
    // Гарантированно сбрасываем состояние загрузки
    processingDecisions.value[decision_id] = false;

    // Добавляем таймаут для гарантии обновления UI
    setTimeout(() => {
      processingDecisions.value = { ...processingDecisions.value };
    }, 100);
  }
};

const onVoteFor = async (row) => {
  processingDecisions.value[row.table.id] = true;

  try {
    await voteForDecision(row);
    SuccessAlert('Голос принят');
    await loadDecisions(route.params.coopname as string);
  } catch (e) {
    FailAlert(e);
  } finally {
    // Гарантированно сбрасываем состояние загрузки
    processingDecisions.value[row.table.id] = false;

    // Добавляем таймаут для гарантии обновления UI
    setTimeout(() => {
      processingDecisions.value = { ...processingDecisions.value };
    }, 100);
  }
};

const onVoteAgainst = async (row) => {
  processingDecisions.value[row.table.id] = true;

  try {
    await voteAgainstDecision(row);
    SuccessAlert('Голос принят');
    await loadDecisions(route.params.coopname as string);
  } catch (e) {
    FailAlert(e);
  } finally {
    // Гарантированно сбрасываем состояние загрузки
    processingDecisions.value[row.table.id] = false;

    // Добавляем таймаут для гарантии обновления UI
    setTimeout(() => {
      processingDecisions.value = { ...processingDecisions.value };
    }, 100);
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
