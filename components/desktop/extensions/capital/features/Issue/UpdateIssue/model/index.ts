import { ref, type Ref } from 'vue';
import { type Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useIssueStore,
  type IUpdateIssueOutput,
} from 'app/extensions/capital/entities/Issue/model';
import { FailAlert } from 'src/shared/api/alerts';
import { extractContentConflict } from 'app/extensions/capital/features/ContentRevisions';

export type IUpdateIssueInput = Mutations.Capital.UpdateIssue.IInput['data'];

export function useUpdateIssue() {
  const store = useIssueStore();

  const initialUpdateIssueInput: Partial<IUpdateIssueInput> = {};

  const updateIssueInput = ref<Partial<IUpdateIssueInput>>({
    ...initialUpdateIssueInput,
  });

  // Состояния для авто-сохранения
  const isAutoSaving = ref(false);
  const autoSaveError = ref<string | null>(null);

  // Таймер для debounce
  let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Функция debounce для отложенного сохранения
  function debounceSave(data: IUpdateIssueInput, projectHash: string, delay = 2000) {
    // Очищаем предыдущий таймер
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Возвращаем Promise с результатом мутации (слитый текст и новый content_rev)
    return new Promise<IUpdateIssueOutput | undefined>((resolve, reject) => {
      // Устанавливаем новый таймер
      autoSaveTimeout = setTimeout(async () => {
        try {
          resolve(await performAutoSave(data, projectHash));
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  // Выполнение авто-сохранения
  async function performAutoSave(data: IUpdateIssueInput, projectHash: string): Promise<IUpdateIssueOutput | undefined> {
    if (isAutoSaving.value) return undefined;

    try {
      isAutoSaving.value = true;
      autoSaveError.value = null;

      return await updateIssue(data, projectHash);
    } catch (error: any) {
      // Конфликт редакций разруливает страница (диалог выбора версии), алерт не нужен
      if (!extractContentConflict(error)) {
        console.error('Auto-save failed:', error);
        autoSaveError.value = 'Ошибка авто-сохранения';
        FailAlert(error);
      }
      throw error; // Выбрасываем ошибку дальше для отката в UI
    } finally {
      isAutoSaving.value = false;
    }
  }

  // Функция для немедленного сохранения (отменяет debounce)
  async function saveImmediately(data: IUpdateIssueInput, projectHash: string) {
    // Очищаем таймер debounce
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = null;
    }

    return await performAutoSave(data, projectHash);
  }

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(
    input: Ref<Partial<IUpdateIssueInput>>,
    initial: Partial<IUpdateIssueInput>,
  ) {
    Object.assign(input.value, initial);
  }

  async function updateIssue(
    data: IUpdateIssueInput,
    projectHash: string,
  ): Promise<IUpdateIssueOutput> {
    const transaction = await api.updateIssue(data);

    // Добавляем/обновляем задачу в списке
    store.addIssue(projectHash, transaction);

    // Сбрасываем updateIssueInput после выполнения updateIssue
    resetInput(updateIssueInput, initialUpdateIssueInput);

    return transaction;
  }

  return {
    updateIssue,
    updateIssueInput,
    // Авто-сохранение
    debounceSave,
    saveImmediately,
    isAutoSaving,
    autoSaveError,
  };
}
export * from './useIssueContentSave';
