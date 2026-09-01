<template lang="pug">
.component-tasks-page
  // Таблица задач компонента
  IssuesListWidget(
    :project-hash='projectHash',
    :can-manage-issues='!!project?.permissions?.can_manage_issues',
    :is-private='project?.origin === "local"',
    @issue-click='handleIssueClick'
  )

  //- Задача открывается оверлеем поверх списка (?issue= в адресе): список не
  //- размонтируется, «назад» закрывает оверлей; полная страница — по кнопке
  IssueOverlay
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api';
import { IssuesListWidget } from 'app/extensions/capital/widgets/IssuesListWidget';
import { IssueOverlay } from 'app/extensions/capital/features/Issue/IssueOverlay';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';

const route = useRoute();
const projectStore = useProjectStore();
const overlay = useQueryOverlay('issue');

// Состояние проекта
const project = ref<IProject | null | undefined>(null);

// Получаем hash проекта из параметров маршрута
const projectHash = computed(() => route.params.project_hash as string);

// Загрузка проекта из store (родитель уже должен загрузить)
const loadProject = async () => {
  // Ищем в кэше / списке / вложенных components
  const foundProject = projectStore.getProject(projectHash.value);
  if (foundProject) {
    project.value = foundProject;
  } else {
    // Если проект не найден в store, пробуем загрузить
    try {
      const loaded = await projectStore.loadProject({
        hash: projectHash.value,
      });
      project.value = (loaded as IProject | undefined) ?? null;
    } catch (error) {
      console.error('Ошибка при загрузке компонента:', error);
      FailAlert('Не удалось загрузить компонент');
    }
  }
};

// Клик по задаче — оверлей поверх списка; полная страница осталась для
// прямых ссылок и кнопки «Открыть задачу» в оверлее
const handleIssueClick = (issue: IIssue) => {
  overlay.open(issue.issue_hash);
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
