<template lang="pug">
div
  // Список компонентов проекта
  ComponentsListWidget(
    :components='project?.components || []',
    :project='project || undefined',
    :expanded='expandedComponents',
    @open-component='handleComponentClick',
    @toggle-component='handleComponentToggle'
  )
    template(#component-content='{ component }')
      IssuesListWidget(
        :project-hash='component.project_hash',
        :can-manage-issues='!!component.permissions?.can_manage_issues',
        :compact='true',
        :is-private='project?.origin === "local" || component.origin === "local"',
        @issue-click='handleIssueClick'
      )
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { useExpandableState } from 'src/shared/lib/composables';
import { ComponentsListWidget } from 'app/extensions/capital/widgets/ComponentsListWidget';
import { IssuesListWidget } from 'app/extensions/capital/widgets/IssuesListWidget';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import { useCapitalWorkspaceRoutes } from 'app/extensions/capital/shared/lib';

const router = useRouter();
const { routeName } = useCapitalWorkspaceRoutes();

// Используем composable для загрузки проекта
const { project, loadProject } = useProjectLoader();

// Композабл для управления состоянием развернутости компонентов
const {
  expanded: expandedComponents,
  loadExpandedState: loadComponentsExpandedState,
  toggleExpanded: toggleComponentExpanded,
} = useExpandableState('capital_project_components_expanded');


// Обработчик клика по компоненту
const handleComponentClick = (componentHash: string) => {
  router.push({
    name: routeName('component-description'),
    params: {
      project_hash: componentHash,
    },
  });
};

// Обработчик переключения компонентов
const handleComponentToggle = (componentHash: string) => {
  toggleComponentExpanded(componentHash);
};

// Обработчик клика по задаче
const handleIssueClick = (issue: IIssue) => {
  router.push({
    name: routeName('component-issue-description'),
    params: {
      project_hash: issue.project_hash,
      issue_hash: issue.issue_hash,
    },
  });
};


// Инициализация
onMounted(async () => {
  await loadProject();
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadComponentsExpandedState();
});
</script>

<style lang="scss" scoped>
</style>
