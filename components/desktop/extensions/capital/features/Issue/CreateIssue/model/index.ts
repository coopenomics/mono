import { ref, type Ref } from 'vue';
import { type Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useIssueStore,
  type ICreateIssueOutput,
} from 'app/extensions/capital/entities/Issue/model';

export type ICreateIssueInput = Mutations.Capital.CreateIssue.IInput['data'];

export function useCreateIssue() {
  const store = useIssueStore();

  const initialCreateIssueInput: ICreateIssueInput = {
    coopname: '',
    title: '',
    labels: [],
    attachments: [],
  };

  const createIssueInput = ref<ICreateIssueInput>({
    ...initialCreateIssueInput,
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(
    input: Ref<ICreateIssueInput>,
    initial: ICreateIssueInput,
  ) {
    Object.assign(input.value, initial);
  }

  async function createIssue(
    data: ICreateIssueInput,
  ): Promise<ICreateIssueOutput> {
    const transaction = await api.createIssue(data);

    // Добавляем задачу в список конкретного проекта (свободные — без кэша проекта)
    if (data.project_hash) {
      store.addIssue(data.project_hash, transaction);
    }

    // Сбрасываем createIssueInput после выполнения createIssue
    resetInput(createIssueInput, initialCreateIssueInput);

    return transaction;
  }

  return { createIssue, createIssueInput };
}
