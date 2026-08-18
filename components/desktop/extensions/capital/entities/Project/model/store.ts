import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import { isComponent, isProject } from 'app/extensions/capital/shared/lib/project-utils';
import type {
  IGetProjectOutput,
  IProjectsPagination,
  IProjectWithRelations,
  IProject,
  IProjectComponent,
  IGetProjectInput,
  IGetProjectsInput,
  IGetProjectWithRelationsInput,
  IGetProjectLogsInput,
  IGetProjectLogsOutput,
} from './types';

const namespace = 'projectStore';

interface IProjectStore {
  projects: Ref<IProjectsPagination>;
  /** Плоский список компонентов кооператива (раздел «Компоненты») */
  components: Ref<IProjectsPagination>;
  /** Кэш загруженных проектов/компонентов по hash (компоненты не попадают в items мастерской) */
  entities: Ref<Record<string, IProject>>;
  getProject: (projectHash: string) => IProject | undefined;
  loadProjects: (data: IGetProjectsInput, append?: boolean) => Promise<IProjectsPagination>;
  loadComponents: (data: IGetProjectsInput, append?: boolean) => Promise<IProjectsPagination>;
  addProjectToList: (projectData: IProject) => void;
  removeProjectFromList: (projectHash: string) => void;
  loadProject: (data: IGetProjectInput) => Promise<IGetProjectOutput>;
  projectWithRelations: Ref<IProjectWithRelations | null>;
  loadProjectWithRelations: (
    data: IGetProjectWithRelationsInput,
  ) => Promise<IProjectWithRelations>;
  loadProjectLogs: (data: IGetProjectLogsInput) => Promise<IGetProjectLogsOutput>;
  isMaster: (project_hash: string, username: string) => Promise<boolean>;
}

export const useProjectStore = defineStore(namespace, (): IProjectStore => {
  const projects = ref<IProjectsPagination>({
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  });
  const components = ref<IProjectsPagination>({
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  });
  const entities = ref<Record<string, IProject>>({});
  const projectWithRelations = ref<IProjectWithRelations | null>(null);

  /**
   * Обновить строку в плоском списке компонентов раздела «Компоненты».
   * Список живёт отдельно от мастерской, поэтому правки (мастер, статус,
   * заголовок), пришедшие через loadProject, иначе до него не доходят.
   */
  const syncIntoComponentsList = (project: IProject) => {
    const idx = components.value.items.findIndex(
      (c) => c.project_hash === project.project_hash,
    );
    if (idx === -1) return;
    components.value.items.splice(idx, 1, {
      ...components.value.items[idx],
      ...project,
    });
  };

  const upsertEntity = (project: IProject) => {
    entities.value = {
      ...entities.value,
      [project.project_hash]: project,
    };
    syncIntoComponentsList(project);
  };

  /** Обновить вложенный компонент в components[] родителя в списке мастерской */
  const syncComponentIntoParent = (component: IProject) => {
    if (!isComponent(component) || !component.parent_hash) return;

    const parentIdx = projects.value.items.findIndex(
      (p) => p.project_hash === component.parent_hash,
    );
    if (parentIdx === -1) return;

    const parent = projects.value.items[parentIdx];
    const comps = [...(parent.components || [])];
    const cIdx = comps.findIndex((c) => c.project_hash === component.project_hash);
    if (cIdx === -1) return;

    comps.splice(cIdx, 1, { ...comps[cIdx], ...component } as IProjectComponent);
    projects.value.items.splice(parentIdx, 1, { ...parent, components: comps });
  };

  const getProject = (projectHash: string): IProject | undefined => {
    if (!projectHash) return undefined;
    if (entities.value[projectHash]) return entities.value[projectHash];

    const top = projects.value.items.find((p) => p.project_hash === projectHash);
    if (top) return top;

    for (const p of projects.value.items) {
      const nested = p.components?.find((c) => c.project_hash === projectHash);
      if (nested) return nested as unknown as IProject;
    }

    const flat = components.value.items.find((c) => c.project_hash === projectHash);
    if (flat) return flat;

    return undefined;
  };

  const loadProjects = async (data: IGetProjectsInput, append = false): Promise<IProjectsPagination> => {
    const loadedData = await api.loadProjects(data);

    if (append && projects.value.items.length > 0) {
      // Объединяем результаты с существующими данными
      projects.value = {
        ...loadedData,
        items: [...projects.value.items, ...loadedData.items],
      };
    } else {
      // Заменяем данные полностью
      projects.value = loadedData;
    }

    // Кэшируем корневые проекты из списка (компоненты — через loadProject / sync)
    for (const item of projects.value.items) {
      upsertEntity(item);
    }

    return projects.value;
  };

  /**
   * Плоский список компонентов кооператива для раздела «Компоненты».
   * Отдельный state: мастерская держит в items только корневые проекты, а
   * здесь items — сами компоненты (filter.is_component на бэкенде).
   */
  const loadComponents = async (
    data: IGetProjectsInput,
    append = false,
  ): Promise<IProjectsPagination> => {
    const loadedData = await api.loadProjects(data);

    if (append && components.value.items.length > 0) {
      components.value = {
        ...loadedData,
        items: [...components.value.items, ...loadedData.items],
      };
    } else {
      components.value = loadedData;
    }

    for (const item of components.value.items) {
      entities.value = {
        ...entities.value,
        [item.project_hash]: item,
      };
    }

    return components.value;
  };

  const addProjectToList = (projectData: IProject) => {
    upsertEntity(projectData);

    // Компонент — только в кэш и в components[] родителя, не на верхний уровень мастерской
    if (isComponent(projectData)) {
      syncComponentIntoParent(projectData);
      return;
    }

    // Ищем существующий проект по _id
    const existingIndex = projects.value.items.findIndex(
      (project) => project._id === projectData._id,
    );

    if (existingIndex !== -1) {
      // Заменяем существующий проект с помощью splice для реактивности
      projects.value.items.splice(existingIndex, 1, projectData);
    } else {
      // Добавляем новый проект в начало списка
      projects.value.items.splice(0, 0, projectData as IProject);
      // Увеличиваем общее количество
      projects.value.totalCount += 1;
    }
  };

  const removeProjectFromList = (projectHash: string) => {
    const idx = projects.value.items.findIndex(
      (p) => p.project_hash === projectHash,
    );
    if (idx !== -1) {
      projects.value.items.splice(idx, 1);
      projects.value.totalCount = Math.max(0, projects.value.totalCount - 1);
    }
    const flatIdx = components.value.items.findIndex(
      (c) => c.project_hash === projectHash,
    );
    if (flatIdx !== -1) {
      components.value.items.splice(flatIdx, 1);
      components.value.totalCount = Math.max(0, components.value.totalCount - 1);
    }
    if (entities.value[projectHash]) {
      const next = { ...entities.value };
      delete next[projectHash];
      entities.value = next;
    }
    if (projectWithRelations.value?.project_hash === projectHash) {
      projectWithRelations.value = null;
    }
  };

  const loadProject = async (data: IGetProjectInput): Promise<IGetProjectOutput> => {
    const loadedData = await api.loadProject(data);
    if (!loadedData) return;

    const project = loadedData as IProject;
    upsertEntity(project);

    // Уже есть на верхнем уровне мастерской — обновить на месте
    const existingIndex = projects.value.items.findIndex(
      (p) => p.project_hash === project.project_hash,
    );

    if (existingIndex !== -1) {
      if (isComponent(project)) {
        // Самолечение: компонент ошибочно лежал на верхнем уровне — убрать
        projects.value.items.splice(existingIndex, 1);
        projects.value.totalCount = Math.max(0, projects.value.totalCount - 1);
        syncComponentIntoParent(project);
      } else {
        projects.value.items.splice(existingIndex, 1, project);
      }
    } else if (isProject(project)) {
      // Корневой проект (создание / первый заход) — в список мастерской
      projects.value.items.splice(0, 0, project);
      projects.value.totalCount += 1;
    } else {
      // Компонент: не засорять верхний уровень — только вложенность родителя
      syncComponentIntoParent(project);
    }

    return loadedData;
  };

  const loadProjectWithRelations = async (
    data: IGetProjectWithRelationsInput,
  ): Promise<IProjectWithRelations> => {
    const loadedData = await api.loadProjectWithRelations(data);
    projectWithRelations.value = loadedData;
    return loadedData;
  };

  const loadProjectLogs = async (data: IGetProjectLogsInput): Promise<IGetProjectLogsOutput> => {
    return await api.loadProjectLogs(data);
  };

  const isMaster = async (project_hash: string, username: string): Promise<boolean> => {
    let project = getProject(project_hash);

    // Если проект не найден, загружаем его
    if (!project) {
      const loadedProject = await loadProject({ hash: project_hash });
      if (!loadedProject) {
        return false;
      }
      project = loadedProject as IProject;
    }

    // Проверяем, является ли пользователь мастером
    return project.master === username;
  };

  return {
    projects,
    components,
    entities,
    getProject,
    projectWithRelations,
    loadProjects,
    loadComponents,
    addProjectToList,
    removeProjectFromList,
    loadProject,
    loadProjectWithRelations,
    loadProjectLogs,
    isMaster,
  };
});
