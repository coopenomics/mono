import { defineStore } from 'pinia';
import { ref, Ref, computed, ComputedRef } from 'vue';
import { api } from '../api';
import type {
  IContributor,
  IContributorsPagination,
  IGetContributorInput,
  IGetContributorsInput,
} from './types';
import { Zeus } from '@coopenomics/sdk';

const namespace = 'contributorStore';

interface IContributorStore {
  contributors: Ref<IContributorsPagination | null>;
  loadContributors: (data: IGetContributorsInput) => Promise<void>;
  contributor: Ref<IContributor | null>;
  loadContributor: (data: IGetContributorInput) => Promise<IContributor | null | undefined>;
  self: Ref<IContributor | null>;
  loadSelf: (data: IGetContributorInput) => Promise<IContributor | null | undefined>;
  updateSelf: (contributorData: IContributor) => void;
  hasClearance: (projectHash: string) => boolean;
  isContributorActiveOrPending: ComputedRef<boolean>;
}

export const useContributorStore = defineStore(
  namespace,
  (): IContributorStore => {
    const contributors = ref<IContributorsPagination | null>(null);
    const contributor = ref<IContributor | null>(null);
    const self = ref<IContributor | null>(null);


    const loadContributors = async (
      data: IGetContributorsInput,
    ): Promise<void> => {
      const loadedData = await api.loadContributors(data);
      contributors.value = loadedData;
    };

    // `| null`: запрос одного участника может его не найти. Интерфейс стора
    // это уже допускал, расходилась только реализация.
    const loadContributor = async (
      data: IGetContributorInput,
    ): Promise<IContributor | null> => {
      const loadedData = await api.loadContributor(data);
      contributor.value = loadedData;
      return loadedData;
    };

    const loadSelf = async (
      data: IGetContributorInput,
    ): Promise<IContributor | null> => {
      const loadedData = await api.loadContributor(data);
      self.value = loadedData;
      return loadedData;
    };

    // Обновление данных текущего пользователя
    const updateSelf = (contributorData: IContributor): void => {
      self.value = contributorData;
    };

    // Проверка наличия допуска у участника по хэшу проекта
    const hasClearance = (projectHash: string): boolean => {
      if (!self.value?.appendixes) return false;
      return self.value.appendixes.includes(projectHash?.toLowerCase() ?? '');
    };

    // Вычисляемые свойства для проверки завершения шагов регистрации
    const isContributorActiveOrPending = computed(() => {
      // Регистрация завершена только если статус 'active'
      // Статус 'import' означает, что участник импортирован, но не завершил регистрацию
      // Статус 'pending' означает, что договор на рассмотрении
      return !!self.value?.present && (self.value?.status === Zeus.ContributorStatus.ACTIVE || self.value?.status === Zeus.ContributorStatus.PENDING);
    });

    return {
      contributors,
      contributor,
      loadContributors,
      loadContributor,
      self,
      loadSelf,
      updateSelf,
      hasClearance,
      isContributorActiveOrPending,
    };
  },
);
