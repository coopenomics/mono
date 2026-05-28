<template lang="pug">
// Показываем лоадер пока данные загружаются
WindowLoader(
  v-if="loading"
  :text="loadingText"
)

// Показываем поздравление если онбординг завершен
slot(name="completion" v-else-if="isCompleted")
  q-card(flat)
    q-card-section.text-center
      q-icon(name="celebration" size="64px" color="positive")
      div.text-h5.q-mt-md {{ completionTitle }}
      div.text-body1.q-mt-sm {{ completionMessage }}

// Показываем шаги если онбординг не завершен и данные загружены
q-card(v-else flat)
  q-card-section.row.items-center.justify-between
    div
      div.text-h5 {{ title }}
      q-chip(
        v-if="countdownLabel"
        color="primary"
        text-color="white"
        icon="schedule"
      ) {{ countdownLabel }}
  q-separator
  q-card-section
    q-list(separator)
      q-item(v-for="(step, index) in steps" :key="step.id")
        q-item-section
          div.row.items-center.q-gutter-sm
            q-icon(
              :name="getIcon(step)"
              :color="getIconColor(step)"
              size="22px"
            )
            div.text-subtitle1 {{ index + 1 }}. {{ step.title }}
          div.text-caption.text-grey-7 {{ step.description }}
          q-chip(
            v-if="step.status === 'in_progress'"
            dense
            color="amber"
            text-color="black"
            icon="hourglass_top"
            class="q-mt-xs"
          ) Ожидаем решение совета
        q-item-section(side)
          q-btn(
            v-if="showAction(index)"
            :disable="submitting"
            color="primary"
            label="Объявить собрание совета"
            @click="() => handleStepClick(step)"
          )

  BaseDialog(
    v-model='dialogOpen',
    :title='dialogTitle',
    size='lg',
    :close-on-backdrop='false',
    :close-on-escape='false',
    @update:model-value='(v) => !v && closeDialog()'
  )
    div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
      q-icon(name="help_outline" size="18px" class="text-primary")
      span Вопрос на повестке
    div.q-mt-sm.q-pa-sm.text-body1.rounded-borders {{ dialogQuestion }}

    q-separator.q-my-md

    div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
      q-icon(name="gavel" size="18px" class="text-primary")
      span Проект решения
    div.q-mt-sm.q-pa-sm.rounded-borders
      div(v-if="dialogDecisionPrefix") {{ dialogDecisionPrefix }}
      DocumentHtmlReader(v-if="dialogDecision" :html="dialogDecision" :sanitize="false")

    template(#footer)
      BaseButton(variant='ghost' :disabled='submitting' @click='closeDialog') Отмена
      BaseButton(variant='primary' :loading='submitting' @click='submitStep') Объявить
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { WindowLoader } from 'src/shared/ui/Loader';
import type { ICouncilOnboardingStep, ICouncilOnboardingConfig } from './types';

interface Props {
  config: ICouncilOnboardingConfig;
  loading?: boolean;
  loadingText?: string;
  title?: string;
  completionTitle?: string;
  completionMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingText: 'Загрузка данных онбординга...',
  title: 'Адаптация к работе на платформе',
  completionTitle: 'Онбординг завершен!',
  completionMessage: 'Все необходимые документы утверждены.',
});

const emit = defineEmits<{
  (e: 'step-submit', step: ICouncilOnboardingStep): void;
}>();

const submitting = ref(false);
const dialogOpen = ref(false);
const currentStep = ref<ICouncilOnboardingStep | null>(null);
const dialogTitle = ref('');
const dialogQuestion = ref('');
const dialogDecision = ref('');
const dialogDecisionPrefix = ref('');

const steps = computed(() => props.config.steps);

const countdownLabel = computed(() => {
  if (!props.config.expireAt) return null;
  const now = new Date();
  const diff = props.config.expireAt.getTime() - now.getTime();
  if (diff <= 0) return 'Время истекло';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `Осталось ${days} дн. ${hours} ч.`;
  }
  return `Осталось ${hours} ч.`;
});

const isCompleted = computed(() => {
  if (props.config.steps.length === 0) return false;
  return props.config.steps.every(step => step.status === 'completed');
});

const getIcon = (step: ICouncilOnboardingStep) => {
  if (step.status === 'completed') return 'task_alt';
  if (step.status === 'in_progress') return 'hourglass_top';
  return 'radio_button_unchecked';
};

const getIconColor = (step: ICouncilOnboardingStep) => {
  if (step.status === 'completed') return 'green-6';
  if (step.status === 'in_progress') return 'orange-6';
  return 'grey-6';
};

const isPrevCompleted = (index: number) => {
  if (index === 0) return true;
  const prev = steps.value[index - 1];
  if (!prev) return true;
  return prev.status === 'completed' || prev.status === 'in_progress';
};

const showAction = (index: number) => {
  const step = steps.value[index];
  if (!step) return false;
  if (step.status === 'completed' || step.status === 'in_progress') return false;
  return isPrevCompleted(index);
};

const handleStepClick = (step: ICouncilOnboardingStep) => {
  currentStep.value = step;
  dialogTitle.value = step.title;
  dialogQuestion.value = step.question;
  dialogDecision.value = step.decision;
  dialogDecisionPrefix.value = step.decisionPrefix || '';
  dialogOpen.value = true;
};

const closeDialog = () => {
  dialogOpen.value = false;
  currentStep.value = null;
  dialogTitle.value = '';
  dialogQuestion.value = '';
  dialogDecision.value = '';
  dialogDecisionPrefix.value = '';
};

const submitStep = async () => {
  if (!currentStep.value) return;

  try {
    submitting.value = true;
    emit('step-submit', currentStep.value);
    closeDialog();
  } finally {
    submitting.value = false;
  }
};
</script>
