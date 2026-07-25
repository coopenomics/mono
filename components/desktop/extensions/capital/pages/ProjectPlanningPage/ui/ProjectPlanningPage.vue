<template lang="pug">
div
  // Сводный план проекта (агрегированные данные)
  q-card(flat).q-mb-lg
    q-card-section
      .text-h6.q-mb-md Сводный план проекта {{ project?.title || 'Загрузка...' }}
      .text-caption.text-grey-6.q-mb-md
        | Агрегированные показатели из всех компонентов проекта
    q-separator
    q-card-section


  // Планы компонентов (если они есть)
  template(v-if="components && components.length > 0")
    q-card.q-mb-lg(flat v-for="component in components" :key="component.project_hash")
      q-card-section
        .text-h6.q-mb-md
          | План компонента: {{ component.title }}

      q-separator
      q-card-section
        ProjectPlanningWidget(
          :project="component"
          :permissions="permissions"
        )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { IProject, IProjectComponent, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { ProjectPlanningWidget } from 'app/extensions/capital/widgets';
import { FailAlert } from 'src/shared/api';

const route = useRoute();
const projectStore = useProjectStore();

// Состояние проекта
const project = ref<IProject | null | undefined>(null);

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Computed для разрешений
const permissions = computed((): IProjectPermissions | null => {
  return project.value?.permissions || null;
});

// Computed для компонентов проекта
const components = computed((): IProjectComponent[] => {
  return (project.value?.components as IProjectComponent[]) || [];
});

// Загрузка проекта с компонентами из store (обычный loadProject уже включает компоненты)
const loadProject = async () => {
  if (!projectHash.value) return;

  try {
    const loaded = await projectStore.loadProject({
      hash: projectHash.value,
    });
    project.value =
      (loaded as IProject | undefined) ??
      projectStore.getProject(projectHash.value) ??
      null;
  } catch (error) {
    console.error('Ошибка при загрузке проекта с компонентами:', error);
    FailAlert('Не удалось загрузить проект с компонентами');
    project.value = null;
  }
};

// Синхронизация с кэшем / списком мастерской
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

// Инициализация
onMounted(async () => {
  await loadProject();
});
</script>

<style lang="scss" scoped>
.q-card {
  margin-bottom: 16px;
}
</style>
