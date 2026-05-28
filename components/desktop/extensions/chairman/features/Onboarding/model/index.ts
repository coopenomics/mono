import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import type { CreateMeetPreset } from 'src/features/Meet/CreateMeet/ui/types';
import { createMeetWithAgenda, type ICreateMeetWithAgendaInput } from 'src/features/Meet/CreateMeet/model';
import {
  buildAgendaStepPresets,
  buildGeneralMeetPreset,
  formatExpireCountdown,
  generalMeetStepPreset,
  type AgendaStepKey,
} from 'app/extensions/chairman/shared/lib';
import { api, type OnboardingState } from '../api';

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
      key: 'general_meet';
      type: 'meet';
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
  const sessionStore = useSessionStore();
  const route = useRoute();

  const onboardingState = ref<OnboardingState | null>(null);
  const loadingAction = ref(false);
  const loadingState = ref(false);
  const meetDialog = ref(false);
  const meetPreset = ref<CreateMeetPreset | undefined>();
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
      title: 'Импорт пайщиков (опционально)',
      description: 'Необязательный шаг. Если у вас уже есть пайщики кооператива — загрузите их списком через CSV-файл. Если нет — просто двигайтесь дальше.',
      done: false,
      pending: false,
    };

    const generalMeetStep: AgendaStep = {
      key: 'general_meet',
      type: 'meet',
      title: generalMeetStepPreset.title,
      description: generalMeetStepPreset.description,
      done: !!onboardingState.value?.general_meet_done,
      pending: !!onboardingState.value?.onboarding_general_meet_hash && !onboardingState.value?.general_meet_done,
    };

    return [...agendaSteps, importStep, generalMeetStep];
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

  // Проверка завершения онбординга - проведено общее собрание
  const isOnboardingCompleted = computed(() => {
    return !!onboardingState.value?.general_meet_done;
  });

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
      SuccessAlert('Предложение создано и шаг отмечен.');
      closeAgendaDialog();
    } catch (error) {
      FailAlert(error);
    } finally {
      loadingAction.value = false;
    }
  };

  const openMeetDialog = () => {
    meetPreset.value = buildGeneralMeetPreset(sessionStore.username);
    meetDialog.value = true;
  };

  const handleCreateMeet = async (data: ICreateMeetWithAgendaInput) => {
    try {
      loadingAction.value = true;
      const coopname = route.params.coopname as string;

      const result = await createMeetWithAgenda({
        coopname: data.coopname || coopname,
        initiator: data.initiator || sessionStore.username,
        presider: data.presider || sessionStore.username,
        secretary: data.secretary || sessionStore.username,
        open_at: data.open_at,
        close_at: data.close_at,
        username: sessionStore.username,
        type: data.type,
        agenda_points: data.agenda_points,
      });

      const meetHash = result?.hash || result?.processing?.meet?.hash || '';

      const state = await api.completeGeneralMeetStep({
        proposal_hash: meetHash,
      });

      onboardingState.value = state;
      SuccessAlert('Общее собрание создано и шаг отмечен.');
      meetDialog.value = false;
      return true;
    } catch (error) {
      FailAlert(error);
      return false;
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
    meetDialog,
    meetPreset,
    agendaDialog,
    init,
    loadState,
    openAgendaDialog,
    closeAgendaDialog,
    submitAgenda,
    openMeetDialog,
    handleCreateMeet,
  };
};
