import { ref, type Ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useFavoritesStore } from 'app/extensions/capital/entities/Favorite';

export type IDeleteProjectInput =
  Mutations.Capital.DeleteProject.IInput['data'];

export function useDeleteProject() {
  const projectStore = useProjectStore();
  const favoritesStore = useFavoritesStore();

  const initialDeleteProjectInput: IDeleteProjectInput = {
    coopname: '',
    project_hash: '',
  };

  const deleteProjectInput = ref<IDeleteProjectInput>({
    ...initialDeleteProjectInput,
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(
    input: Ref<IDeleteProjectInput>,
    initial: IDeleteProjectInput,
  ) {
    Object.assign(input.value, initial);
  }

  async function deleteProject(data: IDeleteProjectInput) {
    const transaction = await api.deleteProject(data);

    projectStore.removeProjectFromList(data.project_hash);
    favoritesStore.dropTarget(data.project_hash);

    // Сбрасываем deleteProjectInput после выполнения deleteProject
    resetInput(deleteProjectInput, initialDeleteProjectInput);

    return transaction;
  }

  return { deleteProject, deleteProjectInput };
}
