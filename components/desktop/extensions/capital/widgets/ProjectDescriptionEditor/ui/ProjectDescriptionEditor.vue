<template lang="pug">
div.q-px-md(ref="pageRootRef")
  EditorSaveBar(
    v-if="project"
    :entity-type="Zeus.CapitalContentEntityType.PROJECT"
    :entity-hash="project.project_hash"
    :current-title="project.title || ''"
    :current-description="description"
    :current-rev="project.content_rev ?? 0"
    :can-edit="canEdit"
    :has-changes="hasChanges"
    :saving="isSaving"
    :note="saveNote"
    @save="save"
    @restored="reload"
  )
  VideoPlayer(v-if="videoUrl" :url="videoUrl")
  .editor-viewport-anchor(ref="editorTopSentinel" aria-hidden="true")
  Editor(
    :min-height="editorMinHeight"
    v-if="project"
    v-model='description',
    :placeholder='placeholder',
    :readonly="!canEdit"
    :padded="false"
    @ready="markOriginal"
  )
  ConflictDialog(v-model="conflictOpen" :conflict="conflict" @resolve="applyResolution")
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { Editor, VideoPlayer } from 'src/shared/ui';
import { buildEditProjectInput, useEditProject } from 'app/extensions/capital/features/Project/EditProject';
import {
  ConflictDialog,
  EditorSaveBar,
  useUnsavedGuard,
  type IContentConflict,
} from 'app/extensions/capital/features/ContentRevisions';
import { toMarkdown } from 'src/shared/lib/utils';
import { SuccessAlert } from 'src/shared/api/alerts';
import { Zeus } from '@coopenomics/sdk';

defineProps<{
  placeholder: string;
}>();

const pageRootRef = ref<HTMLElement | null>(null);
const editorTopSentinel = ref<HTMLElement | null>(null);
const editorMinHeight = useEditorViewportMinHeight(editorTopSentinel, {
  observeRef: pageRootRef,
  min: 280,
  bottomGap: 32,
});

const { save: saveProject, isSaving } = useEditProject();
const { project, loadProject } = useProjectLoader();

/** Эталон после загрузки/сохранения: с ним сравнивается текст редактора */
const originalDescription = ref('');
const saveNote = ref<string | null>(null);
const conflict = ref<IContentConflict | null>(null);
const conflictOpen = ref(false);
/** Редакция, относительно которой пойдёт сохранение (после конфликта — current_rev сервера) */
const baseRevOverride = ref<number | null>(null);

const description = computed({
  get: () => project.value?.description || '',
  set: (value: string) => {
    if (project.value) project.value.description = value;
  },
});

const permissions = computed((): IProjectPermissions | null => project.value?.permissions || null);

const isProjectCompleted = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return status === Zeus.ProjectStatus.RESULT || status === 'RESULT';
});

const canEdit = computed(() => !!permissions.value?.can_edit_project && !isProjectCompleted.value);

const hasChanges = computed(() => !!project.value && description.value !== originalDescription.value);

const videoUrl = computed(() => {
  try {
    const meta = typeof project.value?.meta === 'string' ? JSON.parse(project.value.meta) : project.value?.meta;
    return meta?.video || '';
  } catch {
    return '';
  }
});

/** Редактор нормализует markdown при инициализации — эталон фиксируем уже после этого, иначе «изменения» есть сразу при открытии */
const markOriginal = async () => {
  await nextTick();
  originalDescription.value = description.value;
};

const reload = async () => {
  await loadProject();
  baseRevOverride.value = null;
  saveNote.value = null;
};

const save = async () => {
  if (!project.value || !canEdit.value || !hasChanges.value) return;
  const input = buildEditProjectInput(project.value, {
    description: description.value,
    base_rev: baseRevOverride.value ?? project.value.content_rev ?? undefined,
  });
  const sent = description.value;
  const result = await saveProject(input);
  if (!result.ok) {
    conflict.value = result.conflict;
    conflictOpen.value = true;
    return;
  }
  // Перечитываем: сервер мог слить текст с параллельной правкой и поднял content_rev
  await loadProject();
  baseRevOverride.value = null;
  const merged = (project.value?.description || '') !== sent;
  saveNote.value = merged ? 'Сохранено и слито с параллельными правками' : 'Сохранено';
  SuccessAlert(merged ? 'Сохранено; текст слит с параллельными правками' : 'Описание сохранено');
};

/** Выбор в диалоге конфликта: кладём текст в редактор, дальнейшее сохранение — относительно серверной редакции */
const applyResolution = (value: { title: string; description: string; base_rev: number }) => {
  description.value = value.description;
  baseRevOverride.value = value.base_rev;
  originalDescription.value = '';
};

const onKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void save();
  }
};

useUnsavedGuard(hasChanges);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  await loadProject();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

watch(project, (newProject) => {
  if (newProject?.description) {
    newProject.description = toMarkdown(newProject.description);
  }
  originalDescription.value = newProject?.description || '';
});
</script>

<style lang="scss" scoped>
.editor-viewport-anchor {
  display: block;
  height: 0;
  width: 100%;
  pointer-events: none;
}
</style>
