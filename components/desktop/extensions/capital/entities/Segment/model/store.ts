import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { ISegmentsPagination, IGetSegmentsInput, ISegment } from './types';

const namespace = 'segmentStore';

interface ISegmentStore {
  // Реактивные состояния - сегменты по project_hash
  segmentsByProject: Ref<Record<string, ISegmentsPagination | null>>;
  reloadRequests: Ref<Record<string, number>>;

  // Методы загрузки данных (только запросы!)
  loadSegments: (data: IGetSegmentsInput, append?: boolean) => Promise<ISegmentsPagination>;
  addSegmentToList: (projectHash: string, segmentData: ISegment) => void;
  getSegmentsByProject: (projectHash: string) => ISegmentsPagination | null;
  requestReload: (projectHash: string) => void;
}

export const useSegmentStore = defineStore(namespace, (): ISegmentStore => {
  // Реактивные ref'ы - сегменты по project_hash
  const segmentsByProject = ref<Record<string, ISegmentsPagination | null>>({});

  // Счётчик просьб перечитать список — по одному на проект. Списку нельзя
  // просто подменить содержимое снаружи: он ведёт свой счёт загруженных
  // страниц, и подмена рассинхронизировала бы его с хранилищем. Поэтому
  // действия, меняющие состав участников, просят список перечитать себя сам.
  const reloadRequests = ref<Record<string, number>>({});

  // Методы загрузки (только чтение!)
  const loadSegments = async (
    data: IGetSegmentsInput,
    append = false,
  ): Promise<ISegmentsPagination> => {
    const loadedData = await api.loadSegments(data);
    // Сохраняем сегменты по project_hash
    const projectHash = data.filter?.project_hash;
    if (projectHash) {
      const existing = segmentsByProject.value[projectHash];

      if (append && existing?.items?.length) {
        // Страницы отрезаются по смещению, поэтому появление нового участника
        // между запросами сдвигает границу и одна и та же доля может прийти
        // дважды. Повтор в списке дал бы две строки с одним ключом.
        const seen = new Set(existing.items.map((item) => item.username));
        const fresh = loadedData.items.filter((item) => !seen.has(item.username));

        segmentsByProject.value[projectHash] = {
          ...loadedData,
          items: [...existing.items, ...fresh],
        };
      } else {
        segmentsByProject.value[projectHash] = loadedData;
      }
    }
    return loadedData;
  };

  // Попросить список участников перечитать себя с первой страницы
  const requestReload = (projectHash: string) => {
    if (!projectHash) return;
    reloadRequests.value[projectHash] = (reloadRequests.value[projectHash] || 0) + 1;
  };

  // Получить сегменты по project_hash
  const getSegmentsByProject = (projectHash: string): ISegmentsPagination | null => {
    return segmentsByProject.value[projectHash] || null;
  };


  // Добавляет или обновляет сегмент в списке без загрузки с сервера
  const addSegmentToList = (projectHash: string, segmentData: ISegment) => {
    const projectSegments = segmentsByProject.value[projectHash];
    if (!projectSegments?.items) return;

    // Ищем существующий сегмент по username
    const existingIndex = projectSegments.items.findIndex(
      (segment) => segment.username === segmentData.username,
    );

    if (existingIndex !== -1) {
      // Заменяем существующий сегмент (создаем новый массив для реактивности)
      projectSegments.items.splice(existingIndex, 1, segmentData as any);
    } else {
      // Добавляем новый сегмент в список (создаем новый массив для реактивности)
      projectSegments.items = [...projectSegments.items, segmentData as any];
      projectSegments.totalCount += 1;
    }
  };

  return {
    segmentsByProject,
    reloadRequests,
    loadSegments,
    addSegmentToList,
    getSegmentsByProject,
    requestReload,
  };
});
