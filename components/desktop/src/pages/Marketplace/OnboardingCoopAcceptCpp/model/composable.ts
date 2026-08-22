import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import type {
  ICouncilOnboardingConfig,
  ICouncilOnboardingStep,
} from 'src/shared/ui/CouncilOnboarding';
import {
  completeStep,
  fetchOnboardingState,
  generateDocument,
  type MarketplaceOnboardingState,
} from '../api';

/**
 * L1-онбординг ЦПП «Стол заказов» на платформенном механизме онбординга.
 *
 * Два документа утверждаются Советом по очереди (free-decision):
 *  1. Положение ЦПП «Стол заказов»   — cooptypes 1100.MarketplaceProgramTemplate;
 *  2. Шаблон публичной оферты ЦПП     — cooptypes 1101.MarketplaceOfferTemplate.
 *
 * Статус каждого шага приходит с бэкенда (`done`/`hash`) и обновляется по
 * РЕАЛЬНОМУ ончейн-решению совета. Когда оба шага done — расширение
 * рестартится и `coopAcceptance.accepted` выставляется автоматически.
 */

// step_key (бэкенд) → registry_id рендерящегося документа
const stepToRegistryId: Record<string, number> = {
  marketplace_provision: 1100,
  marketplace_offer_template: 1101,
};

interface StepMeta {
  id: string;
  title: string;
  description: string;
  question: string;
  decisionPrefix: string;
}

const STEP_META: StepMeta[] = [
  {
    id: 'marketplace_provision',
    title: 'Положение о ЦПП «Стол заказов»',
    description:
      'Утверждение Положения о целевой потребительской программе «Стол заказов»',
    question: 'Об утверждении Положения о ЦПП «Стол заказов»',
    decisionPrefix: 'Утвердить Положение о ЦПП «Стол заказов»:',
  },
  {
    id: 'marketplace_offer_template',
    title: 'Шаблон публичной оферты ЦПП «Стол заказов»',
    description:
      'Утверждение шаблона публичной оферты по присоединению пайщиков к ЦПП «Стол заказов»',
    question:
      'Об утверждении шаблона публичной оферты по присоединению к ЦПП «Стол заказов»',
    decisionPrefix:
      'Утвердить шаблон публичной оферты по присоединению к ЦПП «Стол заказов»:',
  },
];

export const useMarketplaceOnboarding = () => {
  const systemStore = useSystemStore();
  const sessionStore = useSessionStore();
  const desktopStore = useDesktopStore();

  const onboardingState = ref<MarketplaceOnboardingState | null>(null);
  const loading = ref(false);
  const submitting = ref(false);
  // HTML документов по step_key — рендерим заранее, чтобы карточка показала
  // содержимое в диалоге «Проект решения».
  const documentsHtml = ref<Record<string, string>>({});

  const statusOf = (
    state: MarketplaceOnboardingState | null,
    stepKey: string,
  ): ICouncilOnboardingStep['status'] => {
    const step = state?.steps?.find((s) => s.step_key === stepKey);
    if (step?.done) return 'completed';
    if (step?.hash) return 'in_progress';
    return 'pending';
  };

  const stepsConfig = computed<ICouncilOnboardingStep[]>(() =>
    STEP_META.map((meta) => ({
      id: meta.id,
      title: meta.title,
      description: meta.description,
      question: meta.question,
      decision: documentsHtml.value[meta.id] || '',
      decisionPrefix: meta.decisionPrefix,
      status: statusOf(onboardingState.value, meta.id),
      hash:
        onboardingState.value?.steps?.find((s) => s.step_key === meta.id)?.hash ||
        null,
    })),
  );

  const config = computed<ICouncilOnboardingConfig>(() => ({
    steps: stepsConfig.value,
    // Счётчик срока адаптации на Столе заказов не показываем — подключение
    // ЦПП не привязано к дедлайну онбординга платформы.
    completionTitle: 'ЦПП «Стол заказов» подключена!',
    completionMessage:
      'Совет утвердил Положение и шаблон оферты. Пайщики могут пользоваться Столом заказов.',
  }));

  const isCompleted = computed(
    () =>
      stepsConfig.value.length > 0 &&
      stepsConfig.value.every((s) => s.status === 'completed'),
  );

  // Как только онбординг завершился (оба документа утверждены Советом →
  // расширение подключилось), grants в getDesktop меняются. Перечитываем
  // desktop workspace, чтобы рабочие столы и страницы Стола заказов появились
  // сразу, без перезагрузки страницы. watch не срабатывает на initial mount —
  // только на реальном переходе false→true в течение сессии.
  watch(isCompleted, async (completed) => {
    if (completed) {
      await desktopStore.loadDesktop();
    }
  });

  const loadState = async () => {
    try {
      loading.value = true;
      await systemStore.loadSystemInfo();
      onboardingState.value = await fetchOnboardingState();

      // Заранее рендерим HTML обоих документов (registry 1100 + 1101).
      const coopname = systemStore.info?.coopname || '';
      const username = sessionStore.username;
      const entries = await Promise.all(
        STEP_META.map(async (meta) => {
          try {
            const registryId = stepToRegistryId[meta.id];
            if (typeof registryId !== 'number') {
              return [meta.id, ''] as const;
            }
            const doc = await generateDocument(coopname, username, registryId);
            return [meta.id, doc.html] as const;
          } catch {
            return [meta.id, ''] as const;
          }
        }),
      );
      documentsHtml.value = Object.fromEntries(entries);
    } catch (error) {
      FailAlert(error);
    } finally {
      loading.value = false;
    }
  };

  const handleStepSubmit = async (step: ICouncilOnboardingStep) => {
    try {
      submitting.value = true;
      const state = await completeStep({
        extension_name: 'market',
        step_key: step.id,
        title: step.title,
        question: step.question,
        decision: documentsHtml.value[step.id] || step.decisionPrefix || '',
      });
      onboardingState.value = state;
      SuccessAlert('Проект решения создан и отправлен в Совет.');
    } catch (error) {
      FailAlert(error);
    } finally {
      submitting.value = false;
    }
  };

  return {
    config,
    loading,
    submitting,
    isCompleted,
    loadState,
    handleStepSubmit,
  };
};
