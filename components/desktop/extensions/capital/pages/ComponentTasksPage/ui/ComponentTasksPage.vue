<template lang="pug">
.component-tasks-page
  // Таблица задач компонента
  IssuesListWidget(
    :project-hash='projectHash',
    :can-manage-issues='!!project?.permissions?.can_manage_issues',
    @issue-click='handleIssueClick'
  )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api';
import { IssuesListWidget } from 'app/extensions/capital/widgets/IssuesListWidget';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();

// Состояние проекта
const project = ref<IProject | null | undefined>(null);

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Загрузка проекта из store (родитель уже должен загрузить)
const loadProject = async () => {
  // Ищем проект в store
  const foundProject = projectStore.projects.items.find(p => p.project_hash === projectHash.value);
  if (foundProject) {
    project.value = foundProject;
  } else {
    // Если проект не найден в store, пробуем загрузить
    try {
      await projectStore.loadProject({
        hash: projectHash.value,
      });
    } catch (error) {
      console.error('Ошибка при загрузке компонента:', error);
      FailAlert('Не удалось загрузить компонент');
    }
  }
};

// Обработчик клика по задаче
const handleIssueClick = (issue: IIssue) => {
  router.push({
    name: 'component-issue-description',
    params: {
      project_hash: projectHash.value,
      issue_hash: issue.issue_hash,
    },
    query: {
      _backRoute: 'component-tasks'
    }
  });
};

// Watcher для синхронизации локального состояния с store
watch(() => projectStore.projects.items, (newItems) => {
  if (newItems && projectHash.value) {
    const foundProject = newItems.find(p => p.project_hash === projectHash.value);
    if (foundProject) {
      project.value = foundProject;
    }
  }
});

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
// Заполняет page-surface, чтобы IssuesListWidget мог взять height: 100%
.component-tasks-page {
  height: 100%;
  min-height: 100%;
}
</style>
