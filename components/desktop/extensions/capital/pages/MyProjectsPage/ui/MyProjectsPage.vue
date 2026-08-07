<template lang="pug">
//- Список на корне; проект/компонент/задача — children (рейл остаётся на «Мои проекты»)
router-view(v-if='!isRoot')
.my-projects-page(v-else)
  ProjectsListWidget(
    :key='projectsListKey',
    :expanded='expanded',
    :master='username',
    origin='any',
    @toggle-expand='handleProjectToggleExpand',
    @data-loaded='handleProjectsDataLoaded',
    @open-project='handleOpenProject'
  )
    template(#project-content='{ project }')
      ComponentsListWidget(
        :components='project.components',
        :project='project',
        :expanded='expandedComponents',
        @open-component='openComponent',
        @toggle-component='handleComponentToggle'
      )
        template(#component-content='{ component }')
          IssuesListWidget(
            :project-hash='component.project_hash',
            :can-manage-issues='!!component.permissions?.can_manage_issues',
            :compact='true',
            :is-private='project.origin === "local" || component.origin === "local"',
            @issue-click='openIssue'
          )
</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onBeforeUnmount, ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useExpandableState } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { ProjectsListWidget, ComponentsListWidget, IssuesListWidget } from 'app/extensions/capital/widgets';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useSessionStore } from 'src/entities/Session';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();
const projectStore = useProjectStore();

const isRoot = computed(() => route.name === 'capital-my-projects');
const username = computed(() => session.username || '');

const projectsListKey = ref(0);
const { clearActions } = useHeaderActions();

const PROJECTS_EXPANDED_KEY = 'capital_my_projects_expanded';
const COMPONENTS_EXPANDED_KEY = 'capital_my_project_components_expanded';

const {
  expanded,
  loadExpandedState: loadProjectsExpandedState,
  cleanupExpandedByKeys: cleanupProjectsExpanded,
  toggleExpanded: toggleProjectExpanded,
} = useExpandableState(PROJECTS_EXPANDED_KEY);

const {
  expanded: expandedComponents,
  loadExpandedState: loadComponentsExpandedState,
  toggleExpanded: toggleComponentExpanded,
} = useExpandableState(COMPONENTS_EXPANDED_KEY);

const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleComponentToggle = (componentHash: string) => {
  toggleComponentExpanded(componentHash);
};

const handleOpenProject = (projectHash: string) => {
  router.push({
    name: 'my-project-description',
    params: { project_hash: projectHash },
  });
};

const openComponent = (componentHash: string) => {
  router.push({
    name: 'my-component-description',
    params: { project_hash: componentHash },
  });
};

const openIssue = (issue: IIssue) => {
  router.push({
    name: 'my-component-issue-description',
    params: {
      project_hash: issue.project_hash,
      issue_hash: issue.issue_hash,
    },
  });
};

const handleProjectsDataLoaded = (projectHashes: string[]) => {
  cleanupProjectsExpanded(projectHashes);
};

onBeforeMount(() => {
  projectStore.projects = {
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  };
});

onMounted(() => {
  loadProjectsExpandedState();
  loadComponentsExpandedState();
});

watch(isRoot, (root) => {
  if (!root) clearActions();
});

watch(username, () => {
  if (isRoot.value) {
    projectsListKey.value++;
  }
});

onBeforeUnmount(() => {
  clearActions();
});
</script>

<style lang="scss" scoped>
.my-projects-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 55px);

  :deep(.projects-list-widget) {
    flex: 1;
    min-height: 0;
  }

  :deep(.projects-scroll-area) {
    max-height: none;
  }
}
</style>
