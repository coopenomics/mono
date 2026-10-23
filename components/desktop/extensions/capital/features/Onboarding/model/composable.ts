import { computed, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { api, type CapitalOnboardingState } from '../api';
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import type { ICouncilOnboardingConfig, ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';
import { client } from 'src/shared/api/client';
import { Cooperative } from 'cooptypes';
import { t } from '../../../i18n';

interface GeneratedDocument {
  hash: string;
  html: string;
  full_title: string;
}

type CapitalOnboardingStepId = Mutations.Capital.CompleteOnboardingStep.IInput['data']['step'];

const onboardingState = ref<CapitalOnboardingState | null>(null);
const loading = ref(false);
const submitting = ref(false);
const generatingDocument = ref(false);
const currentGeneratedDoc = ref<GeneratedDocument | null>(null);

export const useCapitalOnboarding = () => {
  const systemStore = useSystemStore();

  // Шаг → рабочий документ, который совет утверждает в бланке. Шаблоны-двойники
  // «для утверждения» (995, 997, 999) выведены: их тексты расходились с теми,
  // что подписывает пайщик (фабрика утверждений, компонент 66).
  const stepToRegistryId: Record<CapitalOnboardingStepId, number> = {
    'generator_program_template': Cooperative.Registry.GeneratorProgramTemplate.registry_id,
    'generation_contract_template': Cooperative.Registry.GenerationContract.registry_id,
    'generator_offer_template': Cooperative.Registry.GeneratorOffer.registry_id,
    'blagorost_program': Cooperative.Registry.BlagorostProgramTemplate.registry_id,
    'blagorost_offer_template': Cooperative.Registry.BlagorostOffer.registry_id,
  };
  // Документы, в которые подставляются параметры программы из мастера.
  const capitalProgramDocDataRegistryIds = new Set<number>([
    Cooperative.Registry.GeneratorProgramTemplate.registry_id,
    Cooperative.Registry.GeneratorOffer.registry_id,
    Cooperative.Registry.BlagorostProgramTemplate.registry_id,
    Cooperative.Registry.BlagorostOffer.registry_id,
  ]);

  const isCapitalOnboardingStepId = (stepId: string): stepId is CapitalOnboardingStepId => {
    return stepId in stepToRegistryId;
  };

  // Бланк текущей редакции документа — тот же текст, что уйдёт в решение совета.
  const generateDocument = async (step: ICouncilOnboardingStep): Promise<GeneratedDocument> => {
    try {
      generatingDocument.value = true;
      if (!isCapitalOnboardingStepId(step.id)) {
        throw new Error(t('capital.error.onboardingUnknownStep', { stepId: step.id }));
      }

      const registry_id = stepToRegistryId[step.id];
      const docDataHash = onboardingState.value?.capital_program_doc_data_hash;
      if (capitalProgramDocDataRegistryIds.has(registry_id) && !docDataHash) {
        throw new Error(t('capital.error.onboardingParamsNotFilled'));
      }

      const { [Queries.DocumentApprovals.DocumentTemplateBlank.name]: blank } = await client.Query(
        Queries.DocumentApprovals.DocumentTemplateBlank.query,
        {
          variables: {
            coopname: systemStore.info?.coopname || '',
            registry_id,
            edition: Zeus.DocumentTemplateEdition.Current,
            doc_data_hash: capitalProgramDocDataRegistryIds.has(registry_id) ? docDataHash : undefined,
          },
        }
      );

      if (!blank?.html) {
        throw new Error(t('capital.error.onboardingDocumentNotGenerated'));
      }

      return {
        hash: blank.text_hash || '',
        html: blank.html || '',
        full_title: blank.title || '',
      };
    } finally {
      generatingDocument.value = false;
    }
  };

  // Определяем шаги онбординга
  const stepsConfig = computed<ICouncilOnboardingStep[]>(() => {
    const state = onboardingState.value;

    return [
      {
        id: 'generator_program_template',
        title: t('capital.composable.generatorRegulationDocTitle'),
        description: t('capital.composable.generatorRegulationAgendaTitle'),
        question: t('capital.composable.generatorRegulationDecisionTitle'),
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: t('capital.composable.generatorRegulationDecisionText'),
        status: state?.generator_program_template_done ? 'completed' :
                state?.onboarding_generator_program_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generator_program_template_hash === 'string' && state.onboarding_generator_program_template_hash ? state.onboarding_generator_program_template_hash : null,
      },
      {
        id: 'generation_contract_template',
        title: t('capital.composable.contractTemplateDocTitle'),
        description: t('capital.composable.contractTemplateAgendaTitle'),
        question: t('capital.composable.contractTemplateDecisionTitle'),
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: t('capital.composable.contractTemplateDecisionText'),
        status: state?.generation_contract_template_done ? 'completed' :
                state?.onboarding_generation_contract_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generation_contract_template_hash === 'string' && state.onboarding_generation_contract_template_hash ? state.onboarding_generation_contract_template_hash : null,
      },
      {
        id: 'blagorost_program',
        title: t('capital.composable.blagorostRegulationDocTitle'),
        description: t('capital.composable.blagorostRegulationAgendaTitle'),
        question: t('capital.composable.blagorostRegulationDecisionTitle'),
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: t('capital.composable.blagorostRegulationDecisionText'),
        status: state?.blagorost_provision_done ? 'completed' :
                state?.onboarding_blagorost_provision_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_blagorost_provision_hash === 'string' && state.onboarding_blagorost_provision_hash ? state.onboarding_blagorost_provision_hash : null,
      },
      {
        id: 'generator_offer_template',
        title: t('capital.composable.generatorOfferDocTitle'),
        description: t('capital.composable.generatorOfferAgendaTitle'),
        question: t('capital.composable.generatorOfferDecisionTitle'),
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: t('capital.composable.generatorOfferDecisionText'),
        status: state?.generator_offer_template_done ? 'completed' :
                state?.onboarding_generator_offer_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generator_offer_template_hash === 'string' && state.onboarding_generator_offer_template_hash ? state.onboarding_generator_offer_template_hash : null,
        depends_on: ['generation_contract_template'], // Зависит от утверждения шаблона договора
      },
      {
        id: 'blagorost_offer_template',
        title: t('capital.composable.blagorostOfferDocTitle'),
        description: t('capital.composable.blagorostOfferAgendaTitle'),
        question: t('capital.composable.blagorostOfferDecisionTitle'),
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: t('capital.composable.blagorostOfferDecisionText'),
        status: state?.blagorost_offer_template_done ? 'completed' :
                state?.onboarding_blagorost_offer_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_blagorost_offer_template_hash === 'string' && state.onboarding_blagorost_offer_template_hash ? state.onboarding_blagorost_offer_template_hash : null,
        depends_on: ['blagorost_program'], // Зависит от утверждения положения
      },
    ];
  });

  const expireAt = computed(() => {
    const value = onboardingState.value?.onboarding_expire_at;
    if (!value) return null;
    const date = new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
  });

  // Подключение завершено, когда приняты решения совета И заданы параметры
  // положений: без параметров не собрать ни оферты вступающих, ни документы
  // регистрации участника. Решения могли прийти переносом прежних протоколов —
  // тогда председатель попадает прямо на ввод параметров (то же правило, что
  // на сервере — isCapitalL1Complete).
  const isOnboardingCompleted = computed(() => {
    return stepsConfig.value.every(step => step.status === 'completed') && Boolean(onboardingState.value?.capital_program_doc_data_hash);
  });

  const hasPendingCouncilDecisions = computed(() =>
    stepsConfig.value.some((step) => step.status === 'in_progress'),
  );

  const docDataHash = computed(() => onboardingState.value?.capital_program_doc_data_hash || null);
  const isDocParamsReady = computed(() => Boolean(docDataHash.value));

  const config = computed<ICouncilOnboardingConfig>(() => ({
    steps: stepsConfig.value,
    expireAt: expireAt.value,
    completionTitle: t('capital.composable.onboardingCompleteTitle'),
    completionMessage: t('capital.composable.onboardingCompleteText'),
  }));

  const loadState = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) {
        loading.value = true;
      }
      await systemStore.loadSystemInfo();
      onboardingState.value = await api.loadOnboardingState();
    } catch (error) {
      if (!silent) {
        FailAlert(error);
      }
    } finally {
      if (!silent) {
        loading.value = false;
      }
    }
  };

  const refreshState = () => loadState({ silent: true });

  const handleStepClick = async (step: ICouncilOnboardingStep) => {
    try {
      const doc = await generateDocument(step);
      currentGeneratedDoc.value = doc;
      return doc;
    } catch (error) {
      FailAlert(error);
      throw error;
    }
  };

  const handleStepSubmit = async (step: ICouncilOnboardingStep) => {
    try {
      submitting.value = true;

      // Генерируем документ если еще не сгенерирован
      if (!currentGeneratedDoc.value) {
        await handleStepClick(step);
      }

      if (!isCapitalOnboardingStepId(step.id)) {
        throw new Error(t('capital.error.onboardingUnknownStep', { stepId: step.id }));
      }

      // Подготавливаем данные для отправки
      const stepData: Mutations.Capital.CompleteOnboardingStep.IInput['data'] = {
        step: step.id,
        title: step.title,
        question: step.question,
        decision: currentGeneratedDoc.value?.html || step.decisionPrefix || step.decision,
      };

      const state = await api.completeStep(stepData);
      onboardingState.value = state;
      currentGeneratedDoc.value = null;

      SuccessAlert(t('capital.composable.proposalCreatedSuccess'));
    } catch (error) {
      FailAlert(error);
    } finally {
      submitting.value = false;
    }
  };

  const handleDocParamsSaved = async () => {
    onboardingState.value = await api.loadOnboardingState();
  };

  return {
    config,
    loading,
    submitting,
    generatingDocument,
    currentGeneratedDoc,
    isOnboardingCompleted,
    hasPendingCouncilDecisions,
    docDataHash,
    isDocParamsReady,
    loadState,
    refreshState,
    handleStepClick,
    handleStepSubmit,
    handleDocParamsSaved,
  };
};
