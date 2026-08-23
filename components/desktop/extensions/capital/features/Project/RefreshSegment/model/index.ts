import { computed, type ComputedRef, isRef } from 'vue';
import { Mutations, Zeus } from '@coopenomics/sdk';
import { api } from '../api';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';

export type IRefreshSegmentInput =
  Mutations.Capital.RefreshSegment.IInput['data'];

export interface IRefreshSegmentProps {
  segment: ISegment;
  coopname: string;
}

export function useRefreshSegment(propsOrRef: IRefreshSegmentProps | ComputedRef<IRefreshSegmentProps>) {
  const segmentStore = useSegmentStore();
  const projectStore = useProjectStore();

  const currentProps = computed(() => {
    return isRef(propsOrRef) ? propsOrRef.value : propsOrRef;
  });

  // Создаем input на основе переданных пропсов
  const refreshSegmentInput = computed<IRefreshSegmentInput>(() => ({
    coopname: currentProps.value.coopname,
    project_hash: currentProps.value.segment.project_hash || '',
    username: currentProps.value.segment.username || '',
  }));

  // Получаем проект из store (в т.ч. компонент из entities)
  const project = computed(() => {
    return projectStore.getProject(currentProps.value.segment.project_hash);
  });

  // Логика проверки необходимости обновления сегмента (использует общую функцию)
  const needsUpdate = computed(() => segmentNeedsUpdate(currentProps.value.segment));

  async function refreshSegment(data: IRefreshSegmentInput) {
    const transaction = await api.refreshSegment(data);
    return transaction;
  }

  async function refreshSegmentAndUpdateStore(data: IRefreshSegmentInput) {
    const updatedSegment = await refreshSegment(data);

    // Проверяем, что сегмент был возвращен
    if (updatedSegment) {
      // Устанавливаем обновленный сегмент в стор напрямую
      segmentStore.addSegmentToList(data.project_hash, updatedSegment);

      // Обновляем проект в сторе проекта
      await projectStore.loadProject({ hash: data.project_hash });
    }

    return updatedSegment;
  }

  return { refreshSegment, refreshSegmentAndUpdateStore, refreshSegmentInput, needsUpdate, project };
}

// Экспортируемая функция для проверки необходимости обновления сегмента
export function segmentNeedsUpdate(segment: ISegment): boolean {
  return segment.status === Zeus.SegmentStatus.GENERATION;
}
