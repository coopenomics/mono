import { computed, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import type { IProject } from 'app/extensions/capital/entities/Project/model';

/**
 * Проекты, в которые пайщик вправе добавить компонент.
 *
 * Право то же, что открывает полоску «Добавить компонент» внутри проекта —
 * `can_edit_project`. Список нужен там, где родитель заранее не известен:
 * в разделе «Компоненты» компонент создаётся из шапки, и проект выбирается
 * в самом диалоге.
 *
 * Читаем напрямую через api, минуя store: список мастерской на этой странице
 * не показывается, и подменять его выборкой для выпадающего списка нельзя.
 * Состояние общее на кооператив — кнопка в шапке и диалог спрашивают одно и то
 * же, второй запрос был бы лишним.
 */
const projects = ref<IProject[]>([]);
const loading = ref(false);
const loadedForCoopname = ref<string | null>(null);

export function useEditableProjects() {
  const { info } = useSystemStore();

  const hasEditableProjects = computed(() => projects.value.length > 0);

  const options = computed(() =>
    projects.value.map((project) => ({
      value: project.project_hash,
      label: project.title,
    })),
  );

  const getProject = (projectHash: string): IProject | undefined =>
    projects.value.find((project) => project.project_hash === projectHash);

  async function loadEditableProjects(force = false): Promise<void> {
    const coopname = info.coopname;
    if (loading.value) return;
    if (!force && loadedForCoopname.value === coopname) return;

    loading.value = true;
    try {
      const result = await ProjectApi.loadProjects({
        filter: {
          coopname,
          // Только верхний уровень: компонент цепляется к проекту, не к компоненту
          parent_hash: '',
        },
        options: {
          page: 1,
          limit: 100,
          sortBy: 'title',
          sortOrder: 'ASC',
        },
      });

      projects.value = (result?.items || []).filter(
        (project) => project.permissions?.can_edit_project,
      );
      loadedForCoopname.value = coopname;
    } catch (error) {
      console.error('Не удалось загрузить проекты для создания компонента:', error);
      projects.value = [];
    } finally {
      loading.value = false;
    }
  }

  return {
    projects,
    options,
    loading,
    hasEditableProjects,
    getProject,
    loadEditableProjects,
  };
}
