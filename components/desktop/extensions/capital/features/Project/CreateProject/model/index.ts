import { ref, type Ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useProjectStore,
  type ICreateProjectOutput,
} from 'app/extensions/capital/entities/Project/model';

export type ICreateProjectInput =
  Mutations.Capital.CreateProject.IInput['data'];

export type ICreateLocalProjectOutput =
  Mutations.Capital.CreateLocalProject.IOutput[typeof Mutations.Capital.CreateLocalProject.name];

export function useCreateProject() {
  const store = useProjectStore();

  const initialCreateProjectInput: ICreateProjectInput = {
    coopname: '',
    parent_hash: '',
    title: '',
    description: '',
    meta: '',
    project_hash: '',
    data: '',
    invite: '',
  };

  const createProjectInput = ref<ICreateProjectInput>({
    ...initialCreateProjectInput,
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(
    input: Ref<ICreateProjectInput>,
    initial: ICreateProjectInput,
  ) {
    Object.assign(input.value, initial);
  }

  async function createProject(
    data: ICreateProjectInput,
  ): Promise<ICreateProjectOutput> {
    const transaction = await api.createProject(data);

    // Получаем данные только что созданного проекта - loadProject теперь сам обновляет projects.items
    await store.loadProject({
      hash: data.project_hash,
    });

    // Сбрасываем createProjectInput после выполнения createProject
    resetInput(createProjectInput, initialCreateProjectInput);

    return transaction;
  }

  async function createLocalProject(
    data: ICreateProjectInput,
  ): Promise<ICreateLocalProjectOutput> {
    const project = await api.createLocalProject(data);

    await store.loadProject({
      hash: data.project_hash,
    });

    resetInput(createProjectInput, initialCreateProjectInput);

    return project;
  }

  return { createProject, createLocalProject, createProjectInput };
}
