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

  /**
   * Попытка загрузки завершилась, а проекта нет — он удалён или недоступен.
   * Без этого признака страница не отличает «ещё грузится» от «уже никогда
   * не загрузится» и показывает скелетон бесконечно.
   */
  const notFound = ref(false);

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
      notFound.value = !project.value;
    } catch (error) {
      console.error('Ошибка при загрузке проекта:', error);
      FailAlert('Не удалось загрузить проект');
      project.value = null;
      notFound.value = true;
    }
  };

  // Watcher для изменения projectHash
  watch(projectHash, async (newHash, oldHash) => {
    if (newHash && newHash !== oldHash) {
      notFound.value = false;
      await loadProject();
    }
  });

  // Синхронизация с кэшем (в т.ч. компоненты, которых нет в items мастерской)
  watch(
    () => projectStore.entities[projectHash.value],
    (entity) => {
      if (entity) {
        project.value = entity;
        notFound.value = false;
      }
    },
  );

  // Возвращаем интерфейс composable
  return {
    project,
    projectHash,
    notFound,
    loadProject,
  };
}
