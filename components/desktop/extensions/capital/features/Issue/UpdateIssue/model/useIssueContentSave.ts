import { ref, type Ref } from 'vue';
import {
  extractContentConflict,
  type IContentConflict,
} from 'app/extensions/capital/features/ContentRevisions';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import { useUpdateIssue } from './index';

type ContentPatch = { title?: string; description?: string };
type SavedContent = {
  content_rev: number;
  title?: string | null;
  description?: string | null;
} | null | undefined;

/** Итог слияния с сервера: разошёлся с набранным — подменяем текст в редакторе */
function applyServerMerge(issue: IIssue, patch: ContentPatch, updated: SavedContent): void {
  if (!updated) return;
  issue.content_rev = updated.content_rev;
  if (patch.description !== undefined && updated.description !== patch.description) {
    issue.description = updated.description ?? '';
  }
  if (patch.title !== undefined && updated.title !== patch.title) {
    issue.title = updated.title ?? issue.title;
  }
}

/**
 * Автосохранение заголовка и описания задачи с редакциями.
 *
 * base_rev — content_rev, с которого начата правка. Сервер сливает
 * параллельные правки и возвращает итоговый текст: если он разошёлся с тем,
 * что набрал пользователь, подменяем текст в редакторе. Настоящий конфликт
 * (слить не удалось) поднимается наружу через `conflict`/`conflictOpen` —
 * хост показывает ConflictDialog.
 *
 * Общий для полной страницы задачи и для оверлея: правка описания обязана
 * вести себя одинаково там и там, поэтому машина одна.
 */
export function useIssueContentSave(
  issue: Ref<IIssue | null | undefined>,
  projectHash: Ref<string | null | undefined>,
  options: { onSaved?: () => void } = {},
) {
  const { debounceSave, isAutoSaving, autoSaveError } = useUpdateIssue();

  const conflict = ref<IContentConflict | null>(null);
  const conflictOpen = ref(false);

  async function saveIssueContent(patch: ContentPatch): Promise<void> {
    if (!issue.value) return;
    const baseRev = issue.value.content_rev;
    try {
      const updated = await debounceSave(
        { issue_hash: issue.value.issue_hash, ...patch, base_rev: baseRev },
        projectHash.value || '',
      );
      if (issue.value) applyServerMerge(issue.value, patch, updated);
      options.onSaved?.();
    } catch (error) {
      const c = extractContentConflict(error);
      if (c) {
        conflict.value = c;
        conflictOpen.value = true;
        return;
      }
      console.error('Failed to save issue content:', error);
    }
  }

  async function applyConflictResolution(value: {
    title: string;
    description: string;
    base_rev: number;
  }): Promise<void> {
    if (!issue.value) return;
    issue.value.title = value.title;
    issue.value.description = value.description;
    issue.value.content_rev = value.base_rev;
    await saveIssueContent({ title: value.title, description: value.description });
  }

  return {
    isAutoSaving,
    autoSaveError,
    conflict,
    conflictOpen,
    saveIssueContent,
    applyConflictResolution,
  };
}
