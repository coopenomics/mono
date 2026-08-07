import { defineStore } from 'pinia';
import { api } from '../api';
import type { ITimeEntriesPagination, IGetTimeEntriesInput } from './types';
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
  loadTimeEntries: (data: IGetTimeEntriesInput) => Promise<ITimeEntriesPagination>;
  addWorklog: (data: IAddWorklogInput) => Promise<unknown>;
  startTimer: (data: IStartTimerInput) => Promise<unknown>;
  stopTimer: (data: IStopTimerInput) => Promise<unknown>;
  pauseTimer: (data: IPauseTimerInput) => Promise<unknown>;
  resumeTimer: (data: IResumeTimerInput) => Promise<unknown>;
  getOpenTimer: (data: IGetOpenTimerInput) => Promise<unknown>;
}

export const useTimeEntriesStore = defineStore(namespace, (): ITimeEntriesStore => {
  const loadTimeEntries = async (data: IGetTimeEntriesInput): Promise<ITimeEntriesPagination> => {
    return api.loadTimeEntries(data);
  };

  const addWorklog = async (data: IAddWorklogInput) => api.addWorklog(data);
  const startTimer = async (data: IStartTimerInput) => api.startTimer(data);
  const stopTimer = async (data: IStopTimerInput) => api.stopTimer(data);
  const pauseTimer = async (data: IPauseTimerInput) => api.pauseTimer(data);
  const resumeTimer = async (data: IResumeTimerInput) => api.resumeTimer(data);
  const getOpenTimer = async (data: IGetOpenTimerInput) => api.getOpenTimer(data);

  return {
    loadTimeEntries,
    addWorklog,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    getOpenTimer,
  };
});
