<template lang="pug">
q-page.edu-onboarding(role="region" :aria-label="$t('edubridge.configurePage.ariaLabel')")
  CouncilOnboardingCard(
    :config="config"
    :loading="initialLoading"
    :submitting="submitting"
    :title="$t('edubridge.configurePage.title')"
    :subtitle="$t('edubridge.configurePage.subtitle')"
    :completion-title="config.completionTitle"
    :completion-message="config.completionMessage"
    @step-submit="handleStepSubmit"
  )
</template>

<script setup lang="ts">
// realtime: живое обновление шагов подключения — в useExtensionCooperativeOnboarding (ядро), общее для всех ЦПП.
import { computed, onMounted, ref, watch } from 'vue';
import { Queries, Zeus } from '@coopenomics/sdk';
import { Cooperative } from 'cooptypes';
import { client } from 'src/shared/api/client';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useExtensionCooperativeOnboarding } from 'src/features/CooperativeOnboarding';
import { CouncilOnboardingCard, type ICouncilOnboardingConfig, type ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';
import { t } from '../../i18n';

/**
 * L1 — подключение кооперативом ЦПП «Образование» на платформенном механизме
 * онбординга (как у Благороста и Стола заказов): четыре документа уходят в
 * Совет проектами решений, шаг становится «завершён» по реальному он-чейн
 * решению. Когда все четыре утверждены — расширение подключается само.
 */
const EXTENSION_NAME = 'edubridge';

interface StepMeta {
  id: string;
  registryId: number;
  title: string;
  description: string;
  question: string;
  decisionPrefix: string;
}

const STEP_META: StepMeta[] = [
  {
    id: 'education_provision',
    registryId: Cooperative.Registry.EducationProgramTemplate.registry_id,
    title: t('edubridge.configurePage.steps.provision.title'),
    description: t('edubridge.configurePage.steps.provision.description'),
    question: t('edubridge.configurePage.steps.provision.question'),
    decisionPrefix: t('edubridge.configurePage.steps.provision.decisionPrefix'),
  },
  {
    id: 'education_parent_offer_template',
    registryId: Cooperative.Registry.EducationParentOffer.registry_id,
    title: t('edubridge.configurePage.steps.parentOffer.title'),
    description: t('edubridge.configurePage.steps.parentOffer.description'),
    question: t('edubridge.configurePage.steps.parentOffer.question'),
    decisionPrefix: t('edubridge.configurePage.steps.parentOffer.decisionPrefix'),
  },
  {
    id: 'education_teacher_offer_template',
    registryId: Cooperative.Registry.EducationTeacherOffer.registry_id,
    title: t('edubridge.configurePage.steps.teacherOffer.title'),
    description: t('edubridge.configurePage.steps.teacherOffer.description'),
    question: t('edubridge.configurePage.steps.teacherOffer.question'),
    decisionPrefix: t('edubridge.configurePage.steps.teacherOffer.decisionPrefix'),
  },
  {
    id: 'education_contract_template',
    registryId: Cooperative.Registry.EducationParticipationContract.registry_id,
    title: t('edubridge.configurePage.steps.contract.title'),
    description: t('edubridge.configurePage.steps.contract.description'),
    question: t('edubridge.configurePage.steps.contract.question'),
    decisionPrefix: t('edubridge.configurePage.steps.contract.decisionPrefix'),
  },
];

const systemStore = useSystemStore();
const desktopStore = useDesktopStore();
const onboarding = useExtensionCooperativeOnboarding(() => EXTENSION_NAME);
const { isLoading, allDone } = onboarding;
// Лоадер карточки — только пока шаги ещё не загружены. Композабл поднимает
// isLoading и на каждом «объявить собрание», а карточка на loading прячет
// содержимое целиком — страница мигала бы при каждом действии.
const initialLoading = computed(() => isLoading.value && !onboarding.steps.value.length);

const submitting = ref(false);
const documentsHtml = ref<Record<string, string>>({});
const documentErrors = ref<Record<string, string>>({});

function statusOf(stepKey: string): ICouncilOnboardingStep['status'] {
  const step = onboarding.steps.value.find((s) => s.step_key === stepKey);
  if (step?.done) return 'completed';
  if (step?.hash) return 'in_progress';
  return 'pending';
}

const config = computed<ICouncilOnboardingConfig>(() => ({
  steps: STEP_META.map((meta) => ({
    id: meta.id,
    title: meta.title,
    description: meta.description,
    question: meta.question,
    decision: documentsHtml.value[meta.id] || '',
    decisionPrefix: meta.decisionPrefix,
    decisionError: documentErrors.value[meta.id] || null,
    status: statusOf(meta.id),
    hash: onboarding.steps.value.find((s) => s.step_key === meta.id)?.hash || null,
  })),
  completionTitle: t('edubridge.configurePage.completionTitle'),
  completionMessage: t('edubridge.configurePage.completionMessage'),
}));

// Подключение завершилось → гранты изменились: перечитываем столы без перезагрузки.
watch(allDone, async (done) => {
  if (done) await desktopStore.loadDesktop();
});

// Бланк текущей редакции из фабрики утверждений — тот же текст, что уйдёт в
// решение совета (как у Благороста и Стола заказов). Бланк не требует данных
// пайщика и совета, поэтому открывается и до наполнения индекса цепи.
async function renderDocument(registryId: number): Promise<string> {
  const coopname = systemStore.info?.coopname || '';
  const { [Queries.DocumentApprovals.DocumentTemplateBlank.name]: blank } = await client.Query(
    Queries.DocumentApprovals.DocumentTemplateBlank.query,
    { variables: { coopname, registry_id: registryId, edition: Zeus.DocumentTemplateEdition.Current } },
  );
  return blank?.html || '';
}

async function handleStepSubmit(step: ICouncilOnboardingStep): Promise<void> {
  submitting.value = true;
  try {
    await onboarding.completeStep({
      extension_name: EXTENSION_NAME,
      step_key: step.id,
      title: step.title,
      question: step.question,
      decision: documentsHtml.value[step.id] || '',
    });
    SuccessAlert(t('edubridge.configurePage.draftSentSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await systemStore.loadSystemInfo();
  await onboarding.load();
  // Бланки грузятся после показа шагов: окно проекта решения подхватит
  // документ сам, как только он придёт.
  await Promise.all(
    STEP_META.map(async (meta) => {
      try {
        const html = await renderDocument(meta.registryId);
        if (!html) throw new Error(t('edubridge.error.documentBlankEmpty'));
        documentsHtml.value = { ...documentsHtml.value, [meta.id]: html };
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        documentErrors.value = { ...documentErrors.value, [meta.id]: t('edubridge.configurePage.documentBuildError', { reason }) };
      }
    }),
  );
});
</script>

<style scoped>
.edu-onboarding {
  padding: var(--p-6);
}
@media (max-width: 768px) {
  .edu-onboarding {
    padding: var(--p-4);
  }
}
</style>
