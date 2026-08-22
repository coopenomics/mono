<template lang="pug">
div(style="padding-bottom: 100px;")
  // Заголовок страницы
  h4.q-mb-md Редактирование приглашения в компонент

  // Индикатор авто-сохранения
  AutoSaveIndicator(
    :is-auto-saving="isAutoSaving"
    :auto-save-error="autoSaveError"
  ).q-ml-md

  // Редактор приглашения
  Editor(
    :min-height="300",
    v-if="project"
    v-model='invite',
    :placeholder='invitePlaceholder || "Введите приглашение..."',
    :readonly="!permissions?.can_edit_project"
    @change='handleInviteChange'
  ).q-mb-xl
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { IProject, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { Editor, AutoSaveIndicator } from 'src/shared/ui';
import { FailAlert } from 'src/shared/api';
import { useEditProject } from 'app/extensions/capital/features/Project/EditProject';
import { toMarkdown } from 'src/shared/lib/utils';

defineProps<{
  invitePlaceholder?: string;
}>();

const route = useRoute();
const projectStore = useProjectStore();
const { debounceSave, saveImmediately, isAutoSaving, autoSaveError } = useEditProject();

// Состояние проекта
const project = ref<IProject | null | undefined>(null);

// Оригинальное состояние приглашения для отслеживания изменений
const originalInvite = ref('');

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Computed свойства для двухсторонней привязки
const invite = computed({
  get: () => project.value?.invite || '',
  set: (value: string) => {
    if (project.value) {
      project.value.invite = value;
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
  return invite.value !== originalInvite.value;
});

// Загрузка проекта из store (родитель уже должен загрузить)
const loadProject = async () => {
  const foundProject = projectStore.getProject(projectHash.value);
  if (foundProject) {
    project.value = foundProject;
  } else {
    try {
      const loaded = await projectStore.loadProject({
        hash: projectHash.value,
      });
      project.value = (loaded as typeof project.value) ?? null;
    } catch (error) {
      console.error('Ошибка при загрузке компонента:', error);
      FailAlert('Не удалось загрузить компонент');
    }
  }
};

// Проверяем и конвертируем приглашение в Markdown формат если необходимо
const ensureMarkdownFormat = (invite: any) => {
  if (!invite) return '';

  // Используем универсальную утилиту конвертации
  return toMarkdown(invite);
};

// Обработчик изменения приглашения
const handleInviteChange = () => {
  if (!project.value || !permissions.value?.can_edit_project) return;

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

// Watcher для синхронизации локального состояния с store
watch(
  () => projectStore.entities[projectHash.value],
  (entity) => {
    if (entity) project.value = entity;
  },
);

// Watcher для изменения projectHash
watch(projectHash, async (newHash, oldHash) => {
  if (newHash && newHash !== oldHash) {
    await loadProject();
  }
});

// Watcher для конвертации приглашения в Markdown формат при загрузке и инициализации оригинального состояния
watch(project, (newProject) => {
  if (newProject?.invite) {
    newProject.invite = ensureMarkdownFormat(newProject.invite);
    // Инициализируем оригинальное состояние для отслеживания изменений
    originalInvite.value = newProject.invite;
  }
});

// Инициализация
onMounted(async () => {
  await loadProject();
});

// Сохраняем изменения немедленно при уходе со страницы только если есть изменения и права
onBeforeUnmount(async () => {
  if (project.value && !isAutoSaving.value && hasChanges.value && permissions.value?.can_edit_project) {
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
      console.log('Изменения сохранены при уходе со страницы приглашения компонента');
    } catch (error) {
      console.error('Ошибка при сохранении изменений при уходе со страницы приглашения компонента:', error);
    }
  }
});
</script>

<style lang="scss" scoped>
</style>
