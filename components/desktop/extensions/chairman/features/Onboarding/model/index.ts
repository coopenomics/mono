import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import {
  buildAgendaStepPresets,
  formatExpireCountdown,
  type AgendaStepKey,
} from 'app/extensions/chairman/shared/lib';
import { api, type OnboardingState } from '../api';
import { t } from '../../../i18n';

type AgendaStep =
  | {
      key: AgendaStepKey;
      type: 'agenda';
      title: string;
      description: string;
      done: boolean;
      pending: boolean;
    }
  | {
      key: 'import_participants';
      type: 'import';
      title: string;
      description: string;
      done: boolean;
      pending: boolean;
    };

const initialAgendaDialog = {
  open: false,
  step: null as AgendaStepKey | null,
  title: '',
  question: '',
  decision: '',
};

export const useOnboardingFlow = () => {
  const systemStore = useSystemStore();
  const desktopStore = useDesktopStore();
  const router = useRouter();

  const onboardingState = ref<OnboardingState | null>(null);
  const loadingAction = ref(false);
  const loadingState = ref(false);
  const agendaDialog = reactive({ ...initialAgendaDialog });

  const isAgendaStepDone = (key: AgendaStepKey) => {
    const state = onboardingState.value as Record<string, any> | null;
    const stateDone = state?.[`${key}_done`];
    const vars = systemStore.info?.vars as Record<string, any> | undefined;

    const varDoneMap: Partial<Record<AgendaStepKey, boolean>> = {
      wallet_agreement: !!vars?.wallet_agreement?.protocol_number,
      signature_agreement: !!vars?.signature_agreement?.protocol_number,
      privacy_agreement: !!vars?.privacy_agreement?.protocol_number,
      user_agreement: !!vars?.user_agreement?.protocol_number,
      participant_application: !!vars?.participant_application?.protocol_number,
      voskhod_membership: !!vars?.voskhod_membership?.protocol_number,
    };

    return Boolean(stateDone ?? varDoneMap[key]);
  };

  const getAgendaStepHash = (key: AgendaStepKey) => {
    const state = onboardingState.value as Record<string, any> | null;
    return state?.[`onboarding_${key}_hash`] as string | undefined | null;
  };

  const isAgendaStepPending = (key: AgendaStepKey) => {
    if (isAgendaStepDone(key)) return false;
    return !!getAgendaStepHash(key);
  };

  const steps = computed<AgendaStep[]>(() => {
    const presets = buildAgendaStepPresets({
      vars: (systemStore.info?.vars as any) ?? null,
      contacts: (systemStore.info?.contacts as any) ?? null,
      cooperator_account: (systemStore.info?.cooperator_account as any) ?? null,
    });

    const agendaSteps: AgendaStep[] = (Object.keys(presets) as AgendaStepKey[]).map((key) => ({
      key,
      type: 'agenda',
      title: presets[key].title,
      description: presets[key].description,
      done: isAgendaStepDone(key),
      pending: isAgendaStepPending(key),
    }));

    const importStep: AgendaStep = {
      key: 'import_participants',
      type: 'import',
      title: t('chairman.onboarding.importMembersTitle'),
      description: t('chairman.onboarding.importMembersHint'),
      done: false,
      pending: false,
    };

    // Общее собрание о вступлении в союз из онбординга снято (19.10.2026):
    // вступление в союз необязательно. Последний шаг — импорт пайщиков, на нём
    // председатель сам завершает онбординг.
    return [...agendaSteps, importStep];
  });

  const expireAt = computed(() => {
    const value = onboardingState.value?.onboarding_expire_at;
    if (!value) return null;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      !(value instanceof Date)
    ) {
      return null;
    }
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
  });

  const expireAtText = computed(() => formatExpireCountdown(expireAt.value));
  const countdownLabel = computed(() => expireAtText.value || '');

  // Онбординг завершает председатель кнопкой на последнем шаге; отметка
  // хранится в настройках кооператива и убирает пункт меню на всех устройствах.
  const isOnboardingCompleted = computed(() => !!systemStore.info?.settings?.onboarding_completed_at);

  const completeOnboarding = async () => {
    try {
      loadingAction.value = true;
      await api.completeOnboarding();
      await systemStore.loadSystemInfo();
      SuccessAlert(t('chairman.onboarding.completedMessage'));
      desktopStore.goToDefaultPage(router);
    } catch (error) {
      FailAlert(error);
    } finally {
      loadingAction.value = false;
    }
  };

  const loadState = async () => {
    try {
      onboardingState.value = await api.loadOnboardingState();
    } catch (error) {
      FailAlert(error);
    }
  };

  const init = async () => {
    try {
      loadingState.value = true;
      await systemStore.loadSystemInfo();
      await loadState();
    } catch (error) {
      FailAlert(error);
    } finally {
      loadingState.value = false;
    }
  };

  const openAgendaDialog = (step: { key: AgendaStepKey; title: string }) => {
    const presets = buildAgendaStepPresets({
      vars: (systemStore.info?.vars as any) ?? null,
      contacts: (systemStore.info?.contacts as any) ?? null,
      cooperator_account: (systemStore.info?.cooperator_account as any) ?? null,
    });
    agendaDialog.step = step.key;
    agendaDialog.title = step.title;
    agendaDialog.question = presets[step.key].question;
    agendaDialog.decision = presets[step.key].decision;
    agendaDialog.open = true;
  };

  const closeAgendaDialog = () => {
    Object.assign(agendaDialog, initialAgendaDialog);
  };

  const submitAgenda = async () => {
    if (!agendaDialog.step) return;
    try {
      loadingAction.value = true;
      const state = await api.completeAgendaStep({
        step: agendaDialog.step,
        title: agendaDialog.title,
        question: agendaDialog.question,
        decision: agendaDialog.decision,
      });
      onboardingState.value = state;
      SuccessAlert(t('chairman.onboarding.proposalCreatedMessage'));
      closeAgendaDialog();
    } catch (error) {
      FailAlert(error);
    } finally {
      loadingAction.value = false;
    }
  };

  return {
    steps,
    countdownLabel,
    expireAtText,
    isOnboardingCompleted,
    loadingAction,
    loadingState,
    agendaDialog,
    init,
    loadState,
    openAgendaDialog,
    closeAgendaDialog,
    submitAgenda,
    completeOnboarding,
  };
};
