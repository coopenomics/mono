<template lang="pug">
q-page.edu-onboarding(role="region" aria-label="Подключение ЦПП Образование")
  CouncilOnboardingCard(
    :config="config"
    :loading="initialLoading"
    :submitting="submitting"
    title="Подключение ЦПП «Образование»"
    subtitle="Совет кооператива утверждает положение о программе, шаблоны оферт родителя-слушателя и преподавателя и шаблон договора участия в хозяйственной деятельности. После этого пайщики смогут вступать по офертам и записываться на курсы."
    :completion-title="config.completionTitle"
    :completion-message="config.completionMessage"
    @step-submit="handleStepSubmit"
  )
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useExtensionCooperativeOnboarding } from 'src/features/CooperativeOnboarding';
import { CouncilOnboardingCard, type ICouncilOnboardingConfig, type ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';

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
    registryId: 3000,
    title: 'Положение о ЦПП «Образование»',
    description: 'Утверждение Положения о целевой потребительской программе «Образование»',
    question: 'Об утверждении Положения о ЦПП «Образование»',
    decisionPrefix: 'Утвердить Положение о ЦПП «Образование»:',
  },
  {
    id: 'education_parent_offer_template',
    registryId: 3001,
    title: 'Шаблон оферты родителя-слушателя',
    description: 'Утверждение шаблона оферты по присоединению родителей-слушателей к ЦПП «Образование»',
    question: 'Об утверждении шаблона оферты родителя-слушателя по ЦПП «Образование»',
    decisionPrefix: 'Утвердить шаблон оферты родителя-слушателя по ЦПП «Образование»:',
  },
  {
    id: 'education_teacher_offer_template',
    registryId: 3003,
    title: 'Шаблон оферты преподавателя',
    description: 'Утверждение шаблона оферты по присоединению преподавателей к ЦПП «Образование»',
    question: 'Об утверждении шаблона оферты преподавателя по ЦПП «Образование»',
    decisionPrefix: 'Утвердить шаблон оферты преподавателя по ЦПП «Образование»:',
  },
  {
    id: 'education_contract_template',
    registryId: 3005,
    title: 'Шаблон договора участия в хозяйственной деятельности',
    description: 'Утверждение шаблона договора участия преподавателей в хозяйственной деятельности кооператива',
    question: 'Об утверждении шаблона договора участия в хозяйственной деятельности (образование)',
    decisionPrefix: 'Утвердить шаблон договора участия в хозяйственной деятельности (образование):',
  },
];

const systemStore = useSystemStore();
const sessionStore = useSessionStore();
const desktopStore = useDesktopStore();
const onboarding = useExtensionCooperativeOnboarding(() => EXTENSION_NAME);
const { isLoading, allDone } = onboarding;
// Лоадер карточки — только пока шаги ещё не загружены. Композабл поднимает
// isLoading и на каждом «объявить собрание», а карточка на loading прячет
// содержимое целиком — страница мигала бы при каждом действии.
const initialLoading = computed(() => isLoading.value && !onboarding.steps.value.length);

const submitting = ref(false);
const documentsHtml = ref<Record<string, string>>({});

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
    status: statusOf(meta.id),
    hash: onboarding.steps.value.find((s) => s.step_key === meta.id)?.hash || null,
  })),
  completionTitle: 'ЦПП «Образование» подключена!',
  completionMessage: 'Совет утвердил положение, шаблоны оферт и договора. Пайщики могут вступать по офертам и записываться на курсы.',
}));

// Подключение завершилось → гранты изменились: перечитываем столы без перезагрузки.
watch(allDone, async (done) => {
  if (done) await desktopStore.loadDesktop();
});

async function renderDocument(registryId: number): Promise<string> {
  const coopname = systemStore.info?.coopname || '';
  const username = sessionStore.username;
  const input: Mutations.Documents.GenerateDocument.IInput = { input: { data: { coopname, username, registry_id: registryId } } };
  const { [Mutations.Documents.GenerateDocument.name]: result } = await client.Mutation(Mutations.Documents.GenerateDocument.mutation, {
    variables: input,
  });
  return result?.html || '';
}

async function handleStepSubmit(step: ICouncilOnboardingStep): Promise<void> {
  submitting.value = true;
  try {
    await onboarding.completeStep({
      extension_name: EXTENSION_NAME,
      step_key: step.id,
      title: step.title,
      question: step.question,
      decision: documentsHtml.value[step.id] || step.decisionPrefix || '',
    });
    SuccessAlert('Проект решения создан и отправлен в Совет.');
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await systemStore.loadSystemInfo();
  await onboarding.load();
  const entries = await Promise.all(
    STEP_META.map(async (meta) => {
      try {
        return [meta.id, await renderDocument(meta.registryId)] as const;
      } catch {
        return [meta.id, ''] as const;
      }
    }),
  );
  documentsHtml.value = Object.fromEntries(entries);
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
