<template lang="pug">
div.q-px-md(ref="pageRootRef")
  // Индикатор авто-сохранения
  AutoSaveIndicator(
    :is-auto-saving="isAutoSaving"
    :auto-save-error="autoSaveError"
  )

  VideoPlayer(v-if="videoUrl" :url="videoUrl")

  .editor-viewport-anchor(ref="editorTopSentinel" aria-hidden="true")

  Editor(
    :min-height="editorMinHeight"
    v-if="project"
    v-model='description',
    :placeholder='descriptionPlaceholder || "Введите описание..."',
    :readonly="!permissions?.can_edit_project || isProjectCompleted"
    :padded="false"
    @change='handleDescriptionChange'
  )
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { Editor, AutoSaveIndicator, VideoPlayer } from 'src/shared/ui';
import { useEditProject } from 'app/extensions/capital/features/Project/EditProject';
import { toMarkdown } from 'src/shared/lib/utils';
import { Zeus } from '@coopenomics/sdk';

defineProps<{
  descriptionPlaceholder?: string;
}>();

const pageRootRef = ref<HTMLElement | null>(null);
const editorTopSentinel = ref<HTMLElement | null>(null);
const editorMinHeight = useEditorViewportMinHeight(editorTopSentinel, {
  observeRef: pageRootRef,
  min: 280,
  bottomGap: 32,
});

// Используем composable для редактирования проекта с авто-сохранением
const { debounceSave, saveImmediately, isAutoSaving, autoSaveError } = useEditProject();

// Используем composable для загрузки проекта
const { project, loadProject } = useProjectLoader();

// Оригинальное состояние описания для отслеживания изменений
const originalDescription = ref('');

// Computed свойства для двухсторонней привязки
const description = computed({
  get: () => project.value?.description || '',
  set: (value: string) => {
    if (project.value) {
      project.value.description = value;
    }
  }
});

// Computed для разрешений
const permissions = computed((): IProjectPermissions | null => {
  return project.value?.permissions || null;
});

// Computed для проверки наличия изменений
const hasChanges = computed(() => {
  if (!project.value) return false;
  return description.value !== originalDescription.value;
});

// Проверка, является ли проект завершенным (статус RESULT)
const isProjectCompleted = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return status === Zeus.ProjectStatus.RESULT || status === 'RESULT';
});

const videoUrl = computed(() => {
  try {
    const meta = typeof project.value?.meta === 'string' ? JSON.parse(project.value.meta) : project.value?.meta;
    return meta?.video || '';
  } catch {
    return '';
  }
});

// Проверяем и конвертируем описание в Markdown формат если необходимо
const ensureMarkdownFormat = (description: any) => {
  if (!description) return '';

  // Используем универсальную утилиту конвертации
  return toMarkdown(description);
};

// Обработчик изменения описания проекта
const handleDescriptionChange = () => {
  if (!project.value || isProjectCompleted.value || !permissions.value?.can_edit_project) return;

  const updateData = {
    project_hash: project.value.project_hash || '',
    title: project.value.title || '',
    description: project.value.description || '',
    invite: project.value.invite || '',
    coopname: (project.value as any).coopname || '',
    meta: '',
    data: '',
  };

  // Запускаем авто-сохранение с задержкой только при наличии прав
  debounceSave(updateData);
};

// Инициализация
onMounted(async () => {
  await loadProject();
});

// Watcher для конвертации описания в Markdown формат при загрузке и инициализации оригинального состояния
watch(project, (newProject) => {
  if (newProject?.description) {
    newProject.description = ensureMarkdownFormat(newProject.description);
    // Инициализируем оригинальное состояние для отслеживания изменений
    originalDescription.value = newProject.description;
  }
});

onBeforeUnmount(async () => {
  // Сохраняем изменения немедленно при уходе со страницы только если есть изменения и права
  if (project.value && !isAutoSaving.value && !isProjectCompleted.value && hasChanges.value && permissions.value?.can_edit_project) {
    try {
      const updateData = {
        project_hash: project.value.project_hash || '',
        title: project.value.title || '',
        description: project.value.description || '',
        invite: project.value.invite || '',
        coopname: (project.value as any).coopname || '',
        meta: '',
        data: '',
      };

      await saveImmediately(updateData);
      console.log('Изменения сохранены при уходе со страницы');
    } catch (error) {
      console.error('Ошибка при сохранении изменений при уходе со страницы:', error);
    }
  }
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
