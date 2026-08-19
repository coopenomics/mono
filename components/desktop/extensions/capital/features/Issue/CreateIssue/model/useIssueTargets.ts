import { computed, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import type { IProject } from 'app/extensions/capital/entities/Project/model';

/**
 * Компоненты, в которые пайщик вправе добавить задачу.
 *
 * Право то же, что открывает полоску «Добавить задачу» внутри компонента —
 * `can_manage_issues`. Список нужен там, где компонент заранее не известен:
 * в разделе «Задачи» задача создаётся из шапки, и компонент выбирается прямо
 * в диалоге (либо не выбирается вовсе — тогда задача свободная).
 *
 * Состояние общее на кооператив: диалог открывается из разных мест, второй
 * одинаковый запрос был бы лишним.
 */
const components = ref<IProject[]>([]);
const loading = ref(false);
const loadedForCoopname = ref<string | null>(null);

export function useIssueTargets() {
  const { info } = useSystemStore();

  const hasTargets = computed(() => components.value.length > 0);

  /** Подпись «Проект — Компонент»: без проекта одноимённые компоненты не различить. */
  const options = computed(() =>
    components.value.map((component) => ({
      value: component.project_hash,
      label: component.parent_title
        ? `${component.parent_title} — ${component.title}`
        : component.title,
    })),
  );

  const getComponent = (projectHash: string): IProject | undefined =>
    components.value.find((component) => component.project_hash === projectHash);

  async function loadIssueTargets(force = false): Promise<void> {
    const coopname = info.coopname;
    if (loading.value) return;
    if (!force && loadedForCoopname.value === coopname) return;

    loading.value = true;
    try {
      const result = await ProjectApi.loadProjects({
        filter: {
          coopname,
          // Задача живёт в компоненте, поэтому верхний уровень проектов не нужен
          is_component: true,
        },
        options: {
          page: 1,
          limit: 100,
          sortBy: 'title',
          sortOrder: 'ASC',
        },
      });

      components.value = (result?.items || []).filter(
        (component) => component.permissions?.can_manage_issues,
      );
      loadedForCoopname.value = coopname;
    } catch (error) {
      console.error('Не удалось загрузить компоненты для создания задачи:', error);
      components.value = [];
    } finally {
      loading.value = false;
    }
  }

  return {
    components,
    options,
    loading,
    hasTargets,
    getComponent,
    loadIssueTargets,
  };
}
