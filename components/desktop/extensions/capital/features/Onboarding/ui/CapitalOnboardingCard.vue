<template lang="pug">
div.capital-onboarding.q-pa-md
  WindowLoader(
    v-if='loading'
    text='Загрузка данных онбординга...'
  )
  template(v-else-if='!isOnboardingCompleted')
    .capital-onboarding__shell
      BaseBanner.capital-onboarding__banner(variant='info')
        template(#icon)
          q-icon(name='info' size='20px')
        | Сначала заполните параметры положений «ГЕНЕРАТОР» и «БЛАГОРОСТ», затем объявите собрания
        | совета для утверждения документов ЦПП.

      VerticalStepper.capital-onboarding__stepper(
        :steps='wizardSteps'
        :active-key='activeWizardStep'
        :completed='completedWizardSteps'
        :clickable-completed='true'
        @change='onStepperChange'
      )
        template(#active='{ step }')
          CapitalProgramDocumentStepPanel(
            v-if='isDocWizardStep(step.key)'
            v-model='form'
            :preview-html='getDocPreviewHtml(step.key)'
            :loading='isDocStepLoading(step.key)'
            @refresh='refreshDocStep(step.key)'
          )

          CapitalCouncilStepGroup(
            v-else-if='isCouncilGroupStep(step.key)'
            :steps='getCouncilStepsForGroup(step.key)'
            :busy='submitting || generatingDocument'
            :can-declare='canDeclareCouncilStep'
            @declare='openCouncilDialog'
          )

      .capital-onboarding__footer(v-if='showFooter')
        BaseButton(
          v-if='showBackButton'
          variant='ghost'
          :disable='footerBusy'
          @click='goBack'
        ) Назад
        q-space(v-if='showBackButton && showContinueButton')
        BaseButton(
          v-if='showContinueButton'
          variant='primary'
          :class='{ "capital-onboarding__continue--solo": !showBackButton }'
          :loading='footerBusy'
          @click='goNext'
        ) {{ continueLabel }}

  BaseDialog(
    v-model='dialogOpen'
    title='Предложение повестки'
    size='lg'
    :close-on-backdrop='false'
    :close-on-escape='false'
    @update:model-value='(v) => !v && closeDialog()'
  )
    Loader(
      v-if='generatingDocument'
      text='Генерация документа...'
    )
    template(v-else-if='currentStep && currentGeneratedDoc && !generatingDocument')
      .capital-onboarding__dialog-section
        div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
          q-icon(name='help_outline' size='18px' color='primary')
          span Вопрос на повестке
        div.q-mt-sm.t-body {{ currentStep.question }}

        q-separator.q-my-md

        div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
          q-icon(name='gavel' size='18px' color='primary')
          span Проект решения
        div.q-mt-sm
          div(v-if='currentStep.decisionPrefix') {{ currentStep.decisionPrefix }}
          DocumentHtmlReader(:html='currentGeneratedDoc.html' :sanitize='false')
        div.t-caption.text-grey-6.q-mt-sm
          strong {{ currentGeneratedDoc.full_title }}

    template(#footer v-if='currentGeneratedDoc && !generatingDocument')
      BaseButton(variant='ghost' :disable='submitting' @click='closeDialog') Отмена
      BaseButton(variant='primary' :loading='submitting' @click='submitStep') Объявить
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useQuasar } from 'quasar';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { WindowLoader, Loader } from 'src/shared/ui/Loader';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import type { ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import CapitalProgramDocumentStepPanel from './CapitalProgramDocumentStepPanel.vue';
import CapitalCouncilStepGroup from './CapitalCouncilStepGroup.vue';
import { useCapitalOnboarding } from '../model';
import { useCapitalProgramDocParams, getRegistryIdForDocWizardStep } from '../model/useCapitalProgramDocParams';
import {
  COUNCIL_GROUP_FOUNDATION,
  COUNCIL_GROUP_OFFERS,
  COUNCIL_STEP_GROUP_ORDER,
  COUNCIL_WIZARD_STEP_META,
  DOC_WIZARD_STEP_BLAGOROST,
  DOC_WIZARD_STEP_GENERATOR,
  DOC_WIZARD_STEP_ORDER,
  getCouncilStepIdsForGroup,
  isCouncilGroupStep,
  isDocWizardStep,
  normalizeWizardStepKey,
  type CouncilGroupStepKey,
} from '../model/capitalOnboardingWizard';

const $q = useQuasar();

const {
  config,
  loading,
  submitting,
  generatingDocument,
  currentGeneratedDoc,
  isOnboardingCompleted,
  hasPendingCouncilDecisions,
  isDocParamsReady,
  loadState,
  refreshState,
  handleStepClick,
  handleStepSubmit,
  handleDocParamsSaved,
} = useCapitalOnboarding();

const {
  form,
  previews,
  saving,
  loadingRegistryId,
  wizardStepKey,
  restoreDraftFromStorage,
  persistDraftToStorage,
  validateSection,
  loadPreview,
  ensurePreview,
  saveParams,
  setWizardStepKey,
} = useCapitalProgramDocParams({
  onSaved: () => handleDocParamsSaved(),
});

const activeWizardStep = wizardStepKey;
const advancing = ref(false);
const dialogOpen = ref(false);
const currentStep = ref<ICouncilOnboardingStep | null>(null);

const councilSteps = computed(() => config.value?.steps ?? []);

const wizardSteps = computed<StepperStep[]>(() => [
  {
    key: DOC_WIZARD_STEP_GENERATOR,
    label: 'Параметры «ГЕНЕРАТОР»',
    description: 'Переменные положения о целевой программе «ГЕНЕРАТОР»',
  },
  {
    key: DOC_WIZARD_STEP_BLAGOROST,
    label: 'Параметры «БЛАГОРОСТ»',
    description: 'Переменные положения о целевой программе «БЛАГОРОСТ»',
  },
  ...COUNCIL_STEP_GROUP_ORDER.map((groupKey) => ({
    key: groupKey,
    label: COUNCIL_WIZARD_STEP_META[groupKey].label,
    description: COUNCIL_WIZARD_STEP_META[groupKey].description,
    disabled: isCouncilGroupDisabled(groupKey),
  })),
]);

const wizardStepOrder = computed<string[]>(() => [
  ...DOC_WIZARD_STEP_ORDER,
  ...COUNCIL_STEP_GROUP_ORDER,
]);

const completedWizardSteps = computed(() => {
  const completed: string[] = [];
  const activeIndex = wizardStepOrder.value.indexOf(activeWizardStep.value);

  if (activeIndex > 0 || isDocParamsReady.value) {
    completed.push(DOC_WIZARD_STEP_GENERATOR);
  }
  if (isDocParamsReady.value) {
    completed.push(DOC_WIZARD_STEP_BLAGOROST);
  }

  for (const groupKey of COUNCIL_STEP_GROUP_ORDER) {
    if (isCouncilGroupCompleted(groupKey)) {
      completed.push(groupKey);
    }
  }

  return completed;
});

const footerBusy = computed(() => saving.value || advancing.value || !!loadingRegistryId.value);

const showBackButton = computed(() => {
  const index = wizardStepOrder.value.indexOf(activeWizardStep.value);
  return index > 0;
});

const showContinueButton = computed(() => isDocWizardStep(activeWizardStep.value));

const showFooter = computed(() => showBackButton.value || showContinueButton.value);

const continueLabel = computed(() =>
  activeWizardStep.value === DOC_WIZARD_STEP_BLAGOROST ? 'Сохранить и продолжить' : 'Продолжить',
);

function getCouncilStep(stepId: string): ICouncilOnboardingStep | undefined {
  return councilSteps.value.find((step) => step.id === stepId);
}

function getCouncilStepsForGroup(groupKey: CouncilGroupStepKey): ICouncilOnboardingStep[] {
  return getCouncilStepIdsForGroup(groupKey)
    .map((stepId) => getCouncilStep(stepId))
    .filter((step): step is ICouncilOnboardingStep => step != null);
}

function isCouncilGroupCompleted(groupKey: CouncilGroupStepKey): boolean {
  return getCouncilStepsForGroup(groupKey).every((step) => step.status === 'completed');
}

function isCouncilGroupDisabled(groupKey: CouncilGroupStepKey): boolean {
  if (groupKey === COUNCIL_GROUP_FOUNDATION) {
    return !isDocParamsReady.value;
  }
  if (groupKey === COUNCIL_GROUP_OFFERS) {
    return getCouncilStepsForGroup(groupKey).every(
      (step) =>
        step.status !== 'completed' &&
        step.status !== 'in_progress' &&
        !canDeclareCouncilStep(step),
    );
  }
  return true;
}

function getFirstAvailableCouncilGroup(): CouncilGroupStepKey | null {
  for (const groupKey of COUNCIL_STEP_GROUP_ORDER) {
    if (!isCouncilGroupCompleted(groupKey) && !isCouncilGroupDisabled(groupKey)) {
      return groupKey;
    }
  }
  return null;
}

function syncWizardStepWithCouncilProgress() {
  if (!isDocParamsReady.value || isOnboardingCompleted.value) return;

  const firstAvailable = getFirstAvailableCouncilGroup();
  if (!firstAvailable) return;

  const current = activeWizardStep.value;

  if (isDocWizardStep(current)) {
    setWizardStepKey(firstAvailable);
    return;
  }

  if (!isCouncilGroupStep(current)) return;

  if (isCouncilGroupCompleted(current) && firstAvailable !== current) {
    setWizardStepKey(firstAvailable);
  }
}

function getDocPreviewHtml(stepKey: string): string {
  const registryId = getRegistryIdForDocWizardStep(stepKey);
  return registryId ? previews[registryId]?.html ?? '' : '';
}

function isDocStepLoading(stepKey: string): boolean {
  const registryId = getRegistryIdForDocWizardStep(stepKey);
  return registryId != null && loadingRegistryId.value === registryId;
}

async function refreshDocStep(stepKey: string) {
  const registryId = getRegistryIdForDocWizardStep(stepKey);
  if (registryId == null) return;
  await loadPreview(registryId);
}

function canDeclareCouncilStep(step: ICouncilOnboardingStep): boolean {
  if (step.status === 'completed' || step.status === 'in_progress') return false;
  if (!step.depends_on?.length) return true;
  return step.depends_on.every((depId) => getCouncilStep(depId)?.status === 'completed');
}

function onStepperChange(key: string) {
  if (isDocWizardStep(key)) {
    setWizardStepKey(key);
    return;
  }
  if (isCouncilGroupStep(key) && !isCouncilGroupDisabled(key)) {
    setWizardStepKey(key);
  }
}

async function goNext() {
  if (activeWizardStep.value === DOC_WIZARD_STEP_GENERATOR) {
    const validationError = validateSection(994);
    if (validationError) {
      $q.notify({ type: 'warning', message: validationError });
      return;
    }

    advancing.value = true;
    try {
      await ensurePreview(994);
      setWizardStepKey(DOC_WIZARD_STEP_BLAGOROST);
    } finally {
      advancing.value = false;
    }
    return;
  }

  if (activeWizardStep.value === DOC_WIZARD_STEP_BLAGOROST) {
    const validationError = validateSection(998);
    if (validationError) {
      $q.notify({ type: 'warning', message: validationError });
      return;
    }

    advancing.value = true;
    try {
      const saved = await saveParams();
      if (!saved) return;

      const firstCouncilGroup = getFirstAvailableCouncilGroup();
      if (firstCouncilGroup) {
        setWizardStepKey(firstCouncilGroup);
      }
    } finally {
      advancing.value = false;
    }
  }
}

function goBack() {
  const index = wizardStepOrder.value.indexOf(activeWizardStep.value);
  if (index <= 0) return;
  setWizardStepKey(wizardStepOrder.value[index - 1]);
}

async function openCouncilDialog(stepId: string) {
  const step = getCouncilStep(stepId);
  if (!step || !canDeclareCouncilStep(step)) return;

  currentStep.value = step;
  dialogOpen.value = true;
  await handleStepClick(step);
}

function closeDialog() {
  dialogOpen.value = false;
  currentStep.value = null;
}

async function submitStep() {
  if (!currentStep.value) return;
  await handleStepSubmit(currentStep.value);
  closeDialog();
  syncWizardStepWithCouncilProgress();
}

const shouldPollCouncilState = computed(
  () => hasPendingCouncilDecisions.value && !isOnboardingCompleted.value,
);

const { start: startCouncilPoll, stop: stopCouncilPoll } = useDataPoller(
  async () => {
    await refreshState();
    syncWizardStepWithCouncilProgress();
  },
  {
    interval: POLL_INTERVALS.FAST,
    immediate: false,
    enabled: shouldPollCouncilState,
  },
);

function handleVisibilityChange() {
  if (document.hidden || !shouldPollCouncilState.value) return;
  void refreshState().then(() => syncWizardStepWithCouncilProgress());
}

watch(shouldPollCouncilState, (enabled) => {
  if (enabled) {
    startCouncilPoll();
  } else {
    stopCouncilPoll();
  }
});

watch(
  () => councilSteps.value.map((step) => `${step.id}:${step.status}`).join('|'),
  () => {
    syncWizardStepWithCouncilProgress();
  },
);

watch(
  () => activeWizardStep.value,
  (stepKey) => {
    if (!isDocWizardStep(stepKey)) return;
    const registryId = getRegistryIdForDocWizardStep(stepKey);
    if (registryId != null) {
      void ensurePreview(registryId);
    }
  },
);

watch(
  form,
  () => {
    persistDraftToStorage();
  },
  { deep: true },
);

onMounted(async () => {
  await loadState();
  restoreDraftFromStorage();
  setWizardStepKey(normalizeWizardStepKey(activeWizardStep.value));
  syncWizardStepWithCouncilProgress();

  if (isDocWizardStep(activeWizardStep.value)) {
    const registryId = getRegistryIdForDocWizardStep(activeWizardStep.value);
    if (registryId != null) {
      void ensurePreview(registryId);
    }
  }

  if (shouldPollCouncilState.value) {
    startCouncilPoll();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  stopCouncilPoll();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<style scoped lang="scss">
.capital-onboarding {
  display: flex;
  justify-content: center;
  min-height: 100%;
}

.capital-onboarding__shell {
  width: 100%;
  max-width: 920px;
}

.capital-onboarding__banner {
  margin-bottom: var(--p-4);
}

.capital-onboarding__stepper {
  margin-top: var(--p-2);
}

.capital-onboarding__continue--solo {
  margin-left: auto;
}

.capital-onboarding__dialog-section {
  padding: var(--p-1) 0;
}

.capital-onboarding__footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  margin-top: var(--p-5);
  padding: var(--p-4) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
