<template lang="pug">
div
  // Компонент планирования (всегда показывается)
  ProjectPlanningWidget(:project='project' :permissions='permissions')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { IProject, IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
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

// Загрузка проекта из store. Всегда делаем запрос на сервер: если уже видим
// проект в локальном store, он мог быть загружен раньше (до setMaster/setPlan
// и т.д.) и содержать stale-значения. После loadProject store обновится через
// splice — реактивный watcher ниже подхватит свежий объект.
const loadProject = async () => {
  try {
    await projectStore.loadProject({
      hash: projectHash.value,
    });
    const foundProject = projectStore.projects.items.find(p => p.project_hash === projectHash.value);
    if (foundProject) {
      project.value = foundProject;
    }
  } catch (error) {
    console.error('Ошибка при загрузке компонента:', error);
    FailAlert('Не удалось загрузить компонент');
  }
};

// Watcher для синхронизации локального состояния с store.
// {deep: true} обязателен: store обновляет items через splice (мутация in-place),
// без deep watcher не срабатывает при изменении полей внутри объекта проекта
// (например is_planed после setPlan), и компонент остаётся со старым значением.
watch(() => projectStore.projects.items, (newItems) => {
  if (newItems && projectHash.value) {
    const foundProject = newItems.find(p => p.project_hash === projectHash.value);
    if (foundProject) {
      project.value = foundProject;
    }
  }
}, { deep: true });

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
</style>
