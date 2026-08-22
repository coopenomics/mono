<template lang="pug">
div
  q-input(
    v-if="project"
    v-model='title'
    :label='label || "Проект"'
    :readonly="!permissions?.can_edit_project"
    @input="handleFieldChange"
    outline
    type="textarea"
    autogrow
    :hide-bottom-space="!$slots.hint"
    :rules="[val => !!val || 'Название проекта обязательно']"
  ).full-width.capital-title-editor-input
    template(#prepend)
      // Показываем иконку отмены при наличии изменений, иначе - слот с иконкой
      q-btn(
        v-if="hasChanges && project?.permissions?.can_edit_project"
        flat
        round
        dense
        color="negative"
        icon="undo"
        size="sm"
        @click="resetChanges"
      )
        q-tooltip Отменить изменения
      .row.items-center.no-wrap.q-gutter-xs(v-else)
        PrivateShieldIcon(:show='project?.origin === "local"')
        slot(name="prepend-icon")
          q-icon(name='work', size='24px', color='primary')

    template(#append)
      .capital-title-editor-append.column.items-end.justify-center.q-gutter-y-sm
        div(v-if="hasChanges && project?.permissions?.can_edit_project").row.q-gutter-xs.items-center
          q-btn(
            round
            dense
            color="primary"
            icon="save"
            size="sm"
            :loading="isSaving"
            @click="saveChanges"
          )
            q-tooltip Сохранить изменения
        .row.items-center.no-wrap(v-if="!(hasChanges && project?.permissions?.can_edit_project)")
          FavoriteStarButton(
            v-if='project?.project_hash',
            :target-type='favoriteTargetType',
            :target-hash='project.project_hash'
          )
          EntityIdBadge(
            :raw-id="project?.id"
            copy-on-click
            address-clipboard
          )

    template(v-if="$slots.hint", #hint)
      slot(name="hint")
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import type { IProject, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { EntityIdBadge } from 'src/shared/ui';
import { useEditProject } from 'app/extensions/capital/features/Project/EditProject';
import { PrivateShieldIcon } from 'app/extensions/capital/shared/ui';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { isProject } from 'app/extensions/capital/shared/lib/project-utils';
import { Zeus } from '@coopenomics/sdk';

const props = defineProps<{
  project: IProject | null | undefined;
  label?: string;
}>();

// Компонент — тот же CapitalProject с родителем; тип избранного по parent_hash
const favoriteTargetType = computed(() =>
  props.project && isProject(props.project)
    ? Zeus.CapitalFavoriteTargetType.PROJECT
    : Zeus.CapitalFavoriteTargetType.COMPONENT,
);

const emit = defineEmits<{
  fieldChange: [];
  'update:title': [value: string];
}>();

const { saveImmediately } = useEditProject();

// Состояние
const originalProject = ref<IProject | null>(null);
const isSaving = ref(false);
const localTitle = ref('');

// Вычисляемое свойство для определения наличия изменений
const hasChanges = computed(() => {
  if (!originalProject.value) return false;
  return localTitle.value !== originalProject.value.title;
});

// Computed свойства для двухсторонней привязки
const title = computed({
  get: () => localTitle.value,
  set: (value: string) => {
    localTitle.value = value;
    emit('update:title', value);
  }
});

// Computed для разрешений
const permissions = computed((): IProjectPermissions | null => {
  return props.project?.permissions || null;
});

// Обработчик изменения полей
const handleFieldChange = () => {
  emit('fieldChange');
};

// Сохранение изменений
const saveChanges = async () => {
  if (!props.project || !permissions.value?.can_edit_project) return;

  try {
    isSaving.value = true;

    const updateData = {
      project_hash: props.project.project_hash || '',
      title: props.project.title || '',
      description: props.project.description || '',
      invite: props.project.invite || '',
      coopname: (props.project as any).coopname || '',
      meta: '',
      data: '',
    };

    await saveImmediately(updateData);

    // Обновляем оригинальное состояние после успешного сохранения
    if (props.project) {
      originalProject.value = JSON.parse(JSON.stringify(props.project));
    }

    SuccessAlert('Название проекта сохранено успешно');
  } catch (error) {
    console.error('Ошибка при сохранении названия проекта:', error);
    FailAlert('Не удалось сохранить название проекта');
  } finally {
    isSaving.value = false;
  }
};

// Сброс изменений
const resetChanges = () => {
  if (!originalProject.value) return;

  // Восстанавливаем оригинальные значения
  localTitle.value = originalProject.value.title;
  emit('update:title', originalProject.value.title);
};

// Watcher для отслеживания изменений project
watch(() => props.project, (newProject) => {
  if (newProject && !originalProject.value) {
    // Инициализируем оригинальное состояние при первой загрузке
    originalProject.value = JSON.parse(JSON.stringify(newProject));
    localTitle.value = newProject.title || '';
  }
}, { immediate: true, deep: true });
</script>

<style lang="scss" scoped>
.capital-title-editor-input :deep(.q-field__append) {
  align-items: center;
  align-self: stretch;
}

.capital-title-editor-append {
  min-height: 100%;
  max-width: min(100%, 14rem);
}
</style>
