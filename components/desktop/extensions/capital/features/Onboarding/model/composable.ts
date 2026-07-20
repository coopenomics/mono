import { computed, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api, type CapitalOnboardingState } from '../api';
import { Mutations } from '@coopenomics/sdk';
import type { ICouncilOnboardingConfig, ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';
import { client } from 'src/shared/api/client';

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
  const sessionStore = useSessionStore();

  // Маппинг шагов на registry_id
  const stepToRegistryId: Record<CapitalOnboardingStepId, number> = {
    'generator_program_template': 994,
    'generation_contract_template': 997,
    'generator_offer_template': 995,
    'blagorost_program': 998,
    'blagorost_offer_template': 999,
  };
  const capitalProgramDocDataRegistryIds = new Set([994, 995, 998, 999]);

  const isCapitalOnboardingStepId = (stepId: string): stepId is CapitalOnboardingStepId => {
    return stepId in stepToRegistryId;
  };

  // Генерация документа для шага
  const generateDocument = async (step: ICouncilOnboardingStep): Promise<GeneratedDocument> => {
    try {
      generatingDocument.value = true;
      if (!isCapitalOnboardingStepId(step.id)) {
        throw new Error(`Неизвестный шаг онбординга: ${step.id}`);
      }

      const registry_id = stepToRegistryId[step.id];
      const docDataHash = onboardingState.value?.capital_program_doc_data_hash;
      if (capitalProgramDocDataRegistryIds.has(registry_id) && !docDataHash) {
        throw new Error('Сначала заполните параметры документов ЦПП и сформируйте предпросмотр');
      }

      const generateDocInput: Mutations.Documents.GenerateDocument.IInput = {
        input: {
          data: {
            coopname: systemStore.info?.coopname || '',
            username: sessionStore.username,
            registry_id,
            ...(docDataHash && capitalProgramDocDataRegistryIds.has(registry_id) ? { doc_data_hash: docDataHash } : {}),
          },
        },
      };

      const { [Mutations.Documents.GenerateDocument.name]: result } = await client.Mutation(
        Mutations.Documents.GenerateDocument.mutation,
        {
          variables: generateDocInput,
        }
      );

      if (!result?.html) {
        throw new Error('Документ не был сгенерирован');
      }

      return {
        hash: result.hash || '',
        html: result.html || '',
        full_title: result.full_title || '',
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
        title: 'Положение о целевой потребительской программе "ГЕНЕРАТОР"',
        description: 'Утверждение Положения о целевой потребительской программе «ГЕНЕРАТОР»',
        question: 'О утверждении Положения о целевой потребительской программе «ГЕНЕРАТОР»',
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: 'Утвердить Положение о целевой потребительской программе «ГЕНЕРАТОР»:',
        status: state?.generator_program_template_done ? 'completed' :
                state?.onboarding_generator_program_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generator_program_template_hash === 'string' && state.onboarding_generator_program_template_hash ? state.onboarding_generator_program_template_hash : null,
      },
      {
        id: 'generation_contract_template',
        title: 'Шаблон договора участия в хозяйственной деятельности',
        description: 'Утверждение шаблона договора участия в хозяйственной деятельности для работы по программе',
        question: 'О утверждении шаблона договора участия в хозяйственной деятельности',
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: 'Утвердить шаблон договора участия в хозяйственной деятельности:',
        status: state?.generation_contract_template_done ? 'completed' :
                state?.onboarding_generation_contract_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generation_contract_template_hash === 'string' && state.onboarding_generation_contract_template_hash ? state.onboarding_generation_contract_template_hash : null,
      },
      {
        id: 'blagorost_program',
        title: 'Положение о ЦПП «БЛАГОРОСТ»',
        description: 'Утверждение Положения о целевой потребительской программе «БЛАГОРОСТ»',
        question: 'О утверждении Положения о целевой потребительской программе «БЛАГОРОСТ»',
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: 'Утвердить Положение о целевой потребительской программе «БЛАГОРОСТ»:',
        status: state?.blagorost_provision_done ? 'completed' :
                state?.onboarding_blagorost_provision_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_blagorost_provision_hash === 'string' && state.onboarding_blagorost_provision_hash ? state.onboarding_blagorost_provision_hash : null,
      },
      {
        id: 'generator_offer_template',
        title: 'Шаблон пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР"',
        description: 'Утверждение шаблона публичной оферты по ЦПП "ГЕНЕРАТОР" для пайщика',
        question: 'О утверждении шаблона пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР"',
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: 'Утвердить шаблон пользовательского соглашения (оферты) по участию в целевой потребительской программе "ГЕНЕРАТОР":',
        status: state?.generator_offer_template_done ? 'completed' :
                state?.onboarding_generator_offer_template_hash ? 'in_progress' : 'pending',
        hash: typeof state?.onboarding_generator_offer_template_hash === 'string' && state.onboarding_generator_offer_template_hash ? state.onboarding_generator_offer_template_hash : null,
        depends_on: ['generation_contract_template'], // Зависит от утверждения шаблона договора
      },
      {
        id: 'blagorost_offer_template',
        title: 'Пользовательское соглашение (оферта) по ЦПП «БЛАГОРОСТ»',
        description: 'Утверждение пользовательского соглашения (оферты) по присоединению к ЦПП «БЛАГОРОСТ»',
        question: 'О утверждении пользовательского соглашения (оферты) по присоединению к ЦПП «БЛАГОРОСТ»',
        decision: '', // Будет заполнено через генерацию документа
        decisionPrefix: 'Утвердить пользовательское соглашение (оферту) по присоединению к ЦПП «БЛАГОРОСТ»:',
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

  const isOnboardingCompleted = computed(() => {
    return stepsConfig.value.every(step => step.status === 'completed');
  });

  const hasPendingCouncilDecisions = computed(() =>
    stepsConfig.value.some((step) => step.status === 'in_progress'),
  );

  const docDataHash = computed(() => onboardingState.value?.capital_program_doc_data_hash || null);
  const isDocParamsReady = computed(() => Boolean(docDataHash.value));

  const config = computed<ICouncilOnboardingConfig>(() => ({
    steps: stepsConfig.value,
    expireAt: expireAt.value,
    completionTitle: 'Онбординг ЦПП «БЛАГОРОСТ» завершен!',
    completionMessage: 'Все необходимые документы для работы с программой утверждены.',
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
        throw new Error(`Неизвестный шаг онбординга: ${step.id}`);
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

      SuccessAlert('Предложение создано и шаг отмечен.');
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
