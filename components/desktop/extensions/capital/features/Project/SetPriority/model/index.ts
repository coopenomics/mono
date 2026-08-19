import { api, type ISetProjectPriorityInput } from '../api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';

export type { ISetProjectPriorityInput };

export function useSetProjectPriority() {
  const projectStore = useProjectStore();

  /** Мутация возвращает обновлённый проект — кладём его в стор без перезапроса. */
  async function setProjectPriority(data: ISetProjectPriorityInput): Promise<IProject> {
    const updated = await api.setProjectPriority(data);
    projectStore.addProjectToList(updated as IProject);
    return updated as IProject;
  }

  return { setProjectPriority };
}
