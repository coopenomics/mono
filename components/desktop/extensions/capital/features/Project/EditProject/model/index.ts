import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { FailAlert } from 'src/shared/api/alerts';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { extractContentConflict, type IContentConflict } from 'app/extensions/capital/features/ContentRevisions';

export type IEditProjectInput = Mutations.Capital.EditProject.IInput['data'];

/**
 * Полный вход мутации editProject из текущего проекта: контракт `editproj` заменяет все поля,
 * поэтому invite/meta/data всегда берём из проекта (пустая строка стирала бы видео и шаблон),
 * а base_rev = content_rev — сервер сливает правку с параллельными изменениями.
 */
export function buildEditProjectInput(
  project: Pick<IProject, 'project_hash' | 'title' | 'description' | 'invite' | 'meta' | 'data' | 'content_rev'> & {
    coopname?: string | null;
  },
  overrides: Partial<IEditProjectInput> = {},
): IEditProjectInput {
  return {
    project_hash: project.project_hash || '',
    title: project.title || '',
    description: project.description || '',
    invite: project.invite || '',
    coopname: project.coopname || '',
    meta: project.meta || '',
    data: project.data || '',
    base_rev: project.content_rev ?? undefined,
    ...overrides,
  };
}

export type SaveProjectResult = { ok: true } | { ok: false; conflict: IContentConflict };

/**
 * Сохранение проекта/компонента по кнопке (автосохранения нет: каждое сохранение — транзакция в цепь).
 * Конфликт редакций возвращается результатом, прочие ошибки — FailAlert + throw.
 */
export function useEditProject() {
  const isSaving = ref(false);
  const saveError = ref<string | null>(null);
  const conflict = ref<IContentConflict | null>(null);

  async function editProject(data: IEditProjectInput) {
    return await api.editProject(data);
  }

  async function save(data: IEditProjectInput): Promise<SaveProjectResult> {
    isSaving.value = true;
    saveError.value = null;
    try {
      await api.editProject(data);
      return { ok: true };
    } catch (error) {
      const c = extractContentConflict(error);
      if (c) {
        conflict.value = c;
        return { ok: false, conflict: c };
      }
      saveError.value = 'Ошибка сохранения';
      FailAlert(error);
      throw error;
    } finally {
      isSaving.value = false;
    }
  }

  /** Сохранить и бросить ошибку при конфликте (для простых форм: название, видео) */
  async function saveImmediately(data: IEditProjectInput) {
    const result = await save(data);
    if (!result.ok) {
      throw new Error('Документ изменён параллельно: обновите страницу и повторите');
    }
  }

  return {
    editProject,
    save,
    saveImmediately,
    isSaving,
    saveError,
    conflict,
    // Совместимость со старыми вызовами индикатора
    isAutoSaving: isSaving,
    autoSaveError: saveError,
  };
}
