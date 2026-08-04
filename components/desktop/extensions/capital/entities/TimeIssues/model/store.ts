import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { ITimeIssuesPagination, IGetTimeIssuesInput } from './types';

const namespace = 'timeIssuesStore';

interface ITimeIssuesStore {
  timeIssues: Ref<ITimeIssuesPagination | null>;
  /** project_hash последней успешной загрузки — виджеты синкают локальный кэш только для своего проекта */
  lastLoadedProjectHash: Ref<string | null>;
  loadTimeIssues: (data: IGetTimeIssuesInput) => Promise<ITimeIssuesPagination>;
}

export const useTimeIssuesStore = defineStore(namespace, (): ITimeIssuesStore => {
  const timeIssues = ref<ITimeIssuesPagination | null>(null);
  const lastLoadedProjectHash = ref<string | null>(null);

  const loadTimeIssues = async (data: IGetTimeIssuesInput): Promise<ITimeIssuesPagination> => {
    const loadedData = await api.loadTimeIssues(data);
    timeIssues.value = loadedData;
    lastLoadedProjectHash.value = data.filter?.project_hash ?? null;
    return loadedData;
  };

  return {
    timeIssues,
    lastLoadedProjectHash,
    loadTimeIssues,
  };
});
