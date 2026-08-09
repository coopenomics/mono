import { ref, computed, watch, Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from './store';
import type { IProject } from './types';
import { FailAlert } from 'src/shared/api';

/**
 * Composable для загрузки и управления состоянием проекта по hash из маршрута
 * Используется в страницах проекта для автоматической загрузки данных
 */
export function useProjectLoader() {
  const route = useRoute();
  const projectStore = useProjectStore();

  // Реактивное состояние проекта
  const project: Ref<IProject | null | undefined> = ref(null);

  // Получаем hash проекта из параметров маршрута
  const projectHash = computed(() => route.params.project_hash as string);

  // Функция загрузки проекта
  const loadProject = async () => {
    if (!projectHash.value) return;

    try {
      // Всегда загружаем с сервера; компоненты кэшируются в entities, не в items мастерской
      const loaded = await projectStore.loadProject({
        hash: projectHash.value,
      });
      project.value =
        (loaded as IProject | undefined) ??
        projectStore.getProject(projectHash.value) ??
        null;
    } catch (error) {
      console.error('Ошибка при загрузке проекта:', error);
      FailAlert('Не удалось загрузить проект');
      project.value = null;
    }
  };

  // Watcher для изменения projectHash
  watch(projectHash, async (newHash, oldHash) => {
    if (newHash && newHash !== oldHash) {
      await loadProject();
    }
  });

  // Синхронизация с кэшем (в т.ч. компоненты, которых нет в items мастерской)
  watch(
    () => projectStore.entities[projectHash.value],
    (entity) => {
      if (entity) project.value = entity;
    },
  );

  // Возвращаем интерфейс composable
  return {
    project,
    projectHash,
    loadProject,
  };
}
