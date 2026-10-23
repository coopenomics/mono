<template lang="pug">
.component-contributors-page
  // Список участников
  ProjectContributorsList(:project='project')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import ProjectContributorsList from 'app/extensions/capital/widgets/ProjectInfoSelectorWidget/ProjectContributorsList.vue';
import { FailAlert } from 'src/shared/api';
import { t } from '../../../i18n';

const route = useRoute();
const projectStore = useProjectStore();

// Состояние проекта
const project = ref<IProject | null | undefined>(null);

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

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
      FailAlert(t('capital.componentContributorsPage.loadError'));
    }
  }
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

// Инициализация
// realtime: нет источника на вкладке — проект грузит карточка-родитель, вкладка берёт его для прав и заголовка; живые — её внутренние виджеты.
onMounted(async () => {
  await loadProject();
});
</script>

<style lang="scss" scoped>
// Заполняет page-surface, чтобы список мог взять height: 100% и держать
// прокрутку внутри себя
.component-contributors-page {
  height: 100%;
  min-height: 100%;
}
</style>
