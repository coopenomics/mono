import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { api } from '../api';
import type {
  ITimeEntriesPagination,
  IGetTimeEntriesInput,
  ITimerSession,
} from './types';
import type {
  IAddWorklogInput,
  IStartTimerInput,
  IStopTimerInput,
  IPauseTimerInput,
  IResumeTimerInput,
  IGetOpenTimerInput,
} from '../api';

const namespace = 'timeEntriesStore';

interface ITimeEntriesStore {
  /** Открытая сессия таймера участника — одна на всё приложение. */
  openTimer: Ref<ITimerSession | null>;
  openTimerLoaded: Ref<boolean>;
  loadTimeEntries: (data: IGetTimeEntriesInput) => Promise<ITimeEntriesPagination>;
  addWorklog: (data: IAddWorklogInput) => Promise<unknown>;
  startTimer: (data: IStartTimerInput) => Promise<ITimerSession | null>;
  stopTimer: (data: IStopTimerInput) => Promise<unknown>;
  pauseTimer: (data: IPauseTimerInput) => Promise<ITimerSession | null>;
  resumeTimer: (data: IResumeTimerInput) => Promise<ITimerSession | null>;
  getOpenTimer: (data: IGetOpenTimerInput) => Promise<ITimerSession | null>;
  loadOpenTimer: (
    data: IGetOpenTimerInput,
    options?: { force?: boolean },
  ) => Promise<ITimerSession | null>;
}

/**
 * Сессия таймера у участника ровно одна, а показывают её сразу несколько мест
 * (чип времени в строке задачи, блок истории, карточка активного таймера).
 * Держим её общей, иначе после старта из одного места остальные показывают
 * протухшее состояние до перезагрузки страницы.
 */
function createTimerSessionState() {
  const openTimer = ref<ITimerSession | null>(null);
  const openTimerLoaded = ref(false);
  /** Общий in-flight запрос: чип рендерится в каждой строке списка задач —
   *  без дедупликации открытие страницы дало бы N одинаковых запросов. */
  let request: Promise<ITimerSession | null> | null = null;

  const apply = (session: ITimerSession | null) => {
    openTimer.value = session ?? null;
    openTimerLoaded.value = true;
    return openTimer.value;
  };

  const getOpenTimer = async (data: IGetOpenTimerInput) =>
    apply((await api.getOpenTimer(data)) as ITimerSession | null);

  const loadOpenTimer = async (
    data: IGetOpenTimerInput,
    options?: { force?: boolean },
  ): Promise<ITimerSession | null> => {
    if (!options?.force && openTimerLoaded.value) return openTimer.value;
    if (request) return request;

    request = getOpenTimer(data)
      .catch((error) => {
        openTimer.value = null;
        throw error;
      })
      .finally(() => {
        request = null;
      });

    return request;
  };

  return { openTimer, openTimerLoaded, apply, getOpenTimer, loadOpenTimer };
}

export const useTimeEntriesStore = defineStore(namespace, (): ITimeEntriesStore => {
  const timer = createTimerSessionState();

  const loadTimeEntries = async (
    data: IGetTimeEntriesInput,
  ): Promise<ITimeEntriesPagination> => api.loadTimeEntries(data);

  const addWorklog = async (data: IAddWorklogInput) => api.addWorklog(data);

  const startTimer = async (data: IStartTimerInput) =>
    timer.apply((await api.startTimer(data)) as ITimerSession | null);

  const stopTimer = async (data: IStopTimerInput) => {
    const result = await api.stopTimer(data);
    timer.apply(null);
    return result;
  };

  const pauseTimer = async (data: IPauseTimerInput) =>
    timer.apply((await api.pauseTimer(data)) as ITimerSession | null);

  const resumeTimer = async (data: IResumeTimerInput) =>
    timer.apply((await api.resumeTimer(data)) as ITimerSession | null);

  return {
    openTimer: timer.openTimer,
    openTimerLoaded: timer.openTimerLoaded,
    loadTimeEntries,
    addWorklog,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    getOpenTimer: timer.getOpenTimer,
    loadOpenTimer: timer.loadOpenTimer,
  };
});
