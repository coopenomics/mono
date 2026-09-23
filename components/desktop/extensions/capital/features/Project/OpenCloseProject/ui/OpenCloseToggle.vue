<template lang="pug">
q-toggle(
  :readonly='!project?.permissions?.can_edit_project || !currentProject?.is_planed'
  v-model='isProjectOpened',
  :color='isProjectOpened ? "green" : "grey"',
  :label='$t("capital.openCloseToggle.acceptingLabel")',
  :loading='loading',
  size="lg"
  checked-icon="check"
  unchecked-icon="close"
  @update:model-value='handleToggleChange'
)
  q-tooltip(
    v-if='tooltipText'
  ) {{ tooltipText }}
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useOpenCloseProject } from '../model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api/alerts';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { t } from '../../../../i18n';

const props = defineProps<{ project: IProject }>();

const { openProject, closeProject } = useOpenCloseProject();
const store = useProjectStore();
const loading = ref(false);

// Получаем актуальный проект из store по hash
const currentProject = computed(() => {
  // Ищем проект в store по hash
  const projects = store.projects?.items || [];
  return projects.find(p => p.project_hash === props.project?.project_hash) || props.project;
});

// Определяем открыт ли проект для инвестиций (теперь это ref для возможности изменения)
const isProjectOpened = ref(currentProject.value?.is_opened === true);

// Синхронизируем значение с проектом
watchEffect(() => {
  isProjectOpened.value = currentProject.value?.is_opened === true;
});

// Определяем текст подсказки
const tooltipText = computed(() => {
  if (!currentProject.value?.permissions?.can_edit_project) {
    // Если прием инвестиций открыт, подсказываем про остановку
    if (currentProject.value?.is_opened) {
      return t('capital.openCloseToggle.stopPermissionError');
    }
    // Если прием инвестиций закрыт, подсказываем про старт
    return t('capital.openCloseToggle.startPermissionError');
  }
  if (!currentProject.value?.is_planed) {
    return t('capital.openCloseToggle.planRequiredError');
  }
  return '';
});

const handleToggleChange = async (value: boolean) => {
  if (!currentProject.value) {
    // Возвращаем значение обратно если нет проекта
    isProjectOpened.value = !value;
    return;
  }

  // Игнорируем изменение если нет прав редактирования проекта
  if (!currentProject.value.permissions?.can_edit_project) {
    // Возвращаем значение обратно
    isProjectOpened.value = !value;
    return;
  }

  // Игнорируем изменение если не установлен план
  if (!currentProject.value.is_planed) {
    // Возвращаем значение обратно
    isProjectOpened.value = !value;
    return;
  }

  loading.value = true;
  try {
    const inputData = {
      coopname: currentProject.value.coopname || '',
      project_hash: currentProject.value.project_hash,
    };

    if (value) {
      // Открываем проект для инвестиций
      await openProject(inputData);
    } else {
      // Закрываем проект от инвестиций
      await closeProject(inputData);
    }
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
