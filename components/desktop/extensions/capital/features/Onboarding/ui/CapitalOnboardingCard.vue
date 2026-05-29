<template lang="pug">
div
  // Показываем лоадер пока данные загружаются
  WindowLoader(
    v-if="loading"
    text="Загрузка данных онбординга..."
  )
  // Показываем шаги если онбординг не завершен и данные загружены
  q-card(v-else-if="!isOnboardingCompleted" flat)
    q-card-section.row.items-center.justify-between
      div
        div.text-h5 Адаптация к работе с программой "Благорост"

    q-separator
    q-card-section
      q-list(separator)
        q-item(v-for="(step, index) in config?.steps || []" :key="step.id")
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
              :disable="submitting || generatingDocument"
              :loading="generatingDocument && currentStepId === step.id"
              color="primary"
              label="Объявить собрание совета"
              @click="() => openDialog(step)"
            )

    BaseDialog(
      v-model="dialogOpen",
      title="Предложение повестки",
      size="lg",
      :close-on-backdrop="false",
      :close-on-escape="false",
      @update:model-value="(v) => !v && closeDialog()"
    )
      Loader(
        v-if="generatingDocument"
        text="Генерация документа..."
      )
      q-card-section(v-else-if="currentStep && currentGeneratedDoc && !generatingDocument")
        div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
          q-icon(name="help_outline" size="18px" class="text-primary")
          span Вопрос на повестке
        div.q-mt-sm.q-pa-sm.text-body1.rounded-borders {{ currentStep.question }}

        q-separator.q-my-md

        div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
          q-icon(name="gavel" size="18px" class="text-primary")
          span Проект решения
        div.q-mt-sm.q-pa-sm.rounded-borders
          div(v-if="currentStep.decisionPrefix") {{ currentStep.decisionPrefix }}
          DocumentHtmlReader(:html="currentGeneratedDoc.html" :sanitize="false")
        div.q-mt-sm.text-caption.text-grey-6
          strong {{ currentGeneratedDoc.full_title }}

      div.q-pb-lg(v-if="currentGeneratedDoc && !generatingDocument")
        q-btn(flat label="Отмена" @click="closeDialog" :disable="submitting")
        q-btn(
          color="primary"
          label="Объявить"
          :loading="submitting"
          @click="submitStep"
        )
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { WindowLoader, Loader } from 'src/shared/ui/Loader';
import type { ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';
import { useCapitalOnboarding } from '../model';

const {
  config,
  loading,
  submitting,
  generatingDocument,
  currentGeneratedDoc,
  isOnboardingCompleted,
  loadState,
  handleStepClick,
  handleStepSubmit,
} = useCapitalOnboarding();

const dialogOpen = ref(false);
const currentStep = ref<ICouncilOnboardingStep | null>(null);
const currentStepId = ref<string | null>(null);


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

const isDependenciesCompleted = (step: ICouncilOnboardingStep) => {
  if (!step.depends_on || step.depends_on.length === 0) return true;
  if (!config.value?.steps) return true;

  return step.depends_on.every(depId => {
    const depStep = config.value.steps.find(s => s.id === depId);
    return depStep && depStep.status === 'completed';
  });
};

const showAction = (index: number) => {
  if (!config.value?.steps) return false;
  const step = config.value.steps[index];
  if (!step) return false;
  if (step.status === 'completed' || step.status === 'in_progress') return false;
  return isDependenciesCompleted(step);
};

const openDialog = async (step: ICouncilOnboardingStep) => {
  currentStep.value = step;
  currentStepId.value = step.id;
  dialogOpen.value = true;

  // Генерируем документ
  await handleStepClick(step);
};

const closeDialog = () => {
  dialogOpen.value = false;
  currentStep.value = null;
  currentStepId.value = null;
};

const submitStep = async () => {
  if (!currentStep.value) return;

  await handleStepSubmit(currentStep.value);
  closeDialog();
};

onMounted(loadState);
</script>
