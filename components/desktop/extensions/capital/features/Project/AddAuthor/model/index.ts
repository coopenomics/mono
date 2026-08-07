import { ref, type Ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import {
  useSegmentStore,
  CONTRIBUTORS_PAGE_OPTIONS,
} from 'app/extensions/capital/entities/Segment/model';

export type IAddAuthorInput = Mutations.Capital.AddAuthor.IInput['data'];

export function useAddAuthor() {
  const store = useProjectStore();
  const segmentStore = useSegmentStore();

  const initialAddAuthorInput: IAddAuthorInput = {
    author: '',
    coopname: '',
    project_hash: '',
  };

  const addAuthorInput = ref<IAddAuthorInput>({
    ...initialAddAuthorInput,
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(input: Ref<IAddAuthorInput>, initial: IAddAuthorInput) {
    Object.assign(input.value, initial);
  }

  async function addAuthor(data: IAddAuthorInput) {
    const transaction = await api.addAuthor(data);

    // Сбрасываем addAuthorInput после выполнения addAuthor
    resetInput(addAuthorInput, initialAddAuthorInput);

    return transaction;
  }

  // Функция для множественного добавления авторов
  async function addAuthors(authors: string[], baseInput: Omit<IAddAuthorInput, 'author'>) {
    const results: any[] = [];

    for (const author of authors) {
      const inputData = {
        ...baseInput,
        author,
      };

      try {
        const result = await api.addAuthor(inputData);
        results.push(result);
      } catch (error) {
        console.error(`Failed to add author ${author}:`, error);
        throw error; // Пробрасываем ошибку, чтобы остановить выполнение
      }
    }

    // Обновляем проект в store после добавления всех авторов
    // Последний результат содержит обновленный проект
    const lastResult = results[results.length - 1];
    if (lastResult) {
      store.addProjectToList(lastResult);
    }

    // Перечитываем доли участников: новые соавторы появляются именно здесь,
    // а обновление проекта их не приносит. Без этого список участников
    // оставался прежним до перехода на другую страницу и обратно.
    await segmentStore.loadSegments({
      filter: {
        coopname: baseInput.coopname,
        project_hash: baseInput.project_hash,
      },
      options: { ...CONTRIBUTORS_PAGE_OPTIONS },
    });

    // Сбрасываем addAuthorInput после выполнения
    resetInput(addAuthorInput, initialAddAuthorInput);

    return results;
  }

  return { addAuthor, addAuthors, addAuthorInput };
}
