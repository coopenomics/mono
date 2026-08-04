import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { IIssuesPagination, IGetIssuesInput, IIssue, IGetIssueLogsInput, IGetIssueLogsOutput } from './types';

const namespace = 'issueStore';

interface IIssueStore {
  issuesByProject: Ref<Record<string, IIssuesPagination>>;
  loadIssues: (data: IGetIssuesInput, projectHash: string, append?: boolean) => Promise<void>;
  updateIssueByHash: (projectHash: string, issueHash: string) => Promise<void>;
  addIssue: (projectHash: string, issueData: IIssue) => void;
  removeIssue: (projectHash: string, issueHash: string) => void;
  /** После переноса задачи в другой компонент: убрать из старого кэша и положить в новый */
  relocateIssue: (fromProjectHash: string, toProjectHash: string, issueData: IIssue) => void;
  getProjectIssues: (projectHash: string) => IIssuesPagination | null;
  loadIssueLogs: (data: IGetIssueLogsInput) => Promise<IGetIssueLogsOutput>;
}

export const useIssueStore = defineStore(namespace, (): IIssueStore => {
  const issuesByProject = ref<Record<string, IIssuesPagination>>({});

  const loadIssues = async (data: IGetIssuesInput, projectHash: string, append = false): Promise<void> => {
    const loadedData = await api.loadIssues(data);

    if (append && issuesByProject.value[projectHash]) {
      // Объединяем результаты с существующими данными
      const existingData = issuesByProject.value[projectHash];
      issuesByProject.value[projectHash] = {
        ...existingData, // Сохраняем существующие метаданные
        items: [...existingData.items, ...loadedData.items],
        // Обновляем totalCount и totalPages из новых данных
        totalCount: loadedData.totalCount,
        totalPages: loadedData.totalPages,
        currentPage: loadedData.currentPage,
      };
    } else {
      // Заменяем данные полностью
      issuesByProject.value[projectHash] = loadedData;
    }
  };

  const updateIssueByHash = async (projectHash: string, issueHash: string): Promise<void> => {
    try {
      const updatedIssue = await api.loadIssue({ issue_hash: issueHash });
      if (!updatedIssue) {
        return;
      }

      // Обновляем задачу в списке проекта, если он загружен
      const projectIssues = issuesByProject.value[projectHash];
      if (projectIssues) {
        const issueIndex = projectIssues.items.findIndex(
          (issue) => issue.issue_hash === issueHash,
        );

        if (issueIndex !== -1) {
          // Используем splice для реактивного обновления массива
          projectIssues.items.splice(issueIndex, 1, updatedIssue);
        }
      }
    } catch (error) {
      console.error(`Failed to update issue ${issueHash} in project ${projectHash}:`, error);
      throw error;
    }
  };

  const addIssue = (projectHash: string, issueData: IIssue) => {
    if (!projectHash) {
      console.warn('issueStore.addIssue: empty projectHash, skip cache write');
      return;
    }

    const projectIssues = issuesByProject.value[projectHash];
    if (!projectIssues) {
      // Если для проекта еще нет данных, инициализируем пустой массив
      issuesByProject.value[projectHash] = {
        items: [issueData],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      };
      return;
    }

    // Ищем существующую задачу по _id
    const existingIndex = projectIssues.items.findIndex(
      (issue) => issue._id === issueData._id,
    );

    if (existingIndex !== -1) {
      // splice — гарантирует реактивность массива в Pinia
      projectIssues.items.splice(existingIndex, 1, issueData);
    } else {
      // Добавляем новую задачу в начало списка
      projectIssues.items = [issueData, ...projectIssues.items];
      // Увеличиваем общее количество
      projectIssues.totalCount += 1;
    }
  };

  const removeIssue = (projectHash: string, issueHash: string) => {
    const projectIssues = issuesByProject.value[projectHash];
    if (!projectIssues) return;

    // Ищем задачу по issue_hash
    const issueIndex = projectIssues.items.findIndex(
      (issue) => issue.issue_hash === issueHash,
    );

    if (issueIndex !== -1) {
      // Удаляем задачу из списка
      projectIssues.items.splice(issueIndex, 1);
      // Уменьшаем общее количество
      projectIssues.totalCount -= 1;
    }
  };

  const relocateIssue = (fromProjectHash: string, toProjectHash: string, issueData: IIssue) => {
    if (fromProjectHash) {
      removeIssue(fromProjectHash, issueData.issue_hash);
    }
    addIssue(toProjectHash, issueData);
  };

  const loadIssueLogs = async (data: IGetIssueLogsInput): Promise<IGetIssueLogsOutput> => {
    return await api.loadIssueLogs(data);
  };

  const getProjectIssues = (projectHash: string): IIssuesPagination | null => {
    return issuesByProject.value[projectHash] || null;
  };

  return {
    issuesByProject,
    loadIssues,
    updateIssueByHash,
    addIssue,
    removeIssue,
    relocateIssue,
    getProjectIssues,
    loadIssueLogs,
  };
});
