<template lang="pug">
div
  q-card(flat)
    div

      // Виджет списка проектов
      ProjectsListWidget(
        :key='projectsListKey',
        :expanded='expanded',
        :has-issues-with-statuses='hasIssuesWithStatuses',
        :has-issues-with-priorities='hasIssuesWithPriorities',
        :has-issues-with-creators='hasIssuesWithCreators',
        :master='master',
        @toggle-expand='handleProjectToggleExpand',
        @data-loaded='handleProjectsDataLoaded',
        @open-project='handleOpenProject'
        @pagination-changed='handlePaginationChanged'
      )
        template(#project-content='{ project }')
          ComponentsListWidget(
            :components='project.components',
            :expanded='expandedComponents',
            @open-component='(componentHash) => router.push({ name: "component-description", params: { project_hash: componentHash }, query: { _backRoute: "projects-list" } })',
            @toggle-component='handleComponentToggle'
          )
            template(#component-content='{ component }')
              IssuesListWidget(
                :project-hash='component.project_hash',
                :statuses='componentStatuses',
                :priorities='componentPriorities',
                :creators='componentCreators',
                :master='componentMaster',
                :compact='true',
                @issue-click='(issue) => router.push({ name: "component-issue", params: { project_hash: issue.project_hash, issue_hash: issue.issue_hash }, query: { _backRoute: "projects-list" } })'
              )


  // Floating Action Button для создания проекта
  Fab(v-if='session.isChairman || session.isMember')
    template(#actions)
      CreateProjectFabAction(ref='createProjectFabRef')
</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onBeforeUnmount, ref, computed, markRaw, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useExpandableState } from 'src/shared/lib/composables';
import { Fab } from 'src/shared/ui';
import { FilterDialogWithButton } from 'app/extensions/capital/shared/ui';
import { useHeaderActions } from 'src/shared/hooks';
import { CreateProjectFabAction } from 'app/extensions/capital/features/Project/CreateProject';
import { ProjectsListWidget, ComponentsListWidget, IssuesListWidget } from 'app/extensions/capital/widgets';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useSessionStore } from 'src/entities/Session';
import { useCapitalFabHotkeys } from 'app/extensions/capital/shared/lib';

const router = useRouter();
const session = useSessionStore();

const createProjectFabRef = ref<{ openDialog: () => void } | null>(null);
const capitalFabHotkeysEnabled = computed(() => session.isChairman || session.isMember);

useCapitalFabHotkeys(
  () => ({
    project: () => createProjectFabRef.value?.openDialog(),
  }),
  { enabled: capitalFabHotkeysEnabled },
);

// Используем store для фильтров
const projectStore = useProjectStore();

// Вычисляемые свойства для фильтров
const hasIssuesWithStatuses = computed(() => projectStore.projectFilters.statuses);
const hasIssuesWithPriorities = computed(() => projectStore.projectFilters.priorities);
const hasIssuesWithCreators = computed(() => projectStore.projectFilters.creators);
const master = computed(() => projectStore.projectFilters.master);

// Для компонентов используем те же фильтры
const componentStatuses = computed(() => projectStore.projectFilters.statuses);
const componentPriorities = computed(() => projectStore.projectFilters.priorities);
const componentCreators = computed(() => projectStore.projectFilters.creators);
const componentMaster = computed(() => projectStore.projectFilters.master);

const projectsListKey = ref(0);

// Регистрируем кнопку фильтров в header
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

// Кнопка фильтров для header
const filterButton = computed(() => ({
  id: 'projects-filter-menu',
  component: markRaw(FilterDialogWithButton),
  props: {},
  stretch: true,
  style: { height: 'var(--header-action-height)' },
  order: 1,
}));

// Ключи для сохранения состояния в LocalStorage
const PROJECTS_EXPANDED_KEY = 'capital_projects_expanded';
const COMPONENTS_EXPANDED_KEY = 'capital_project_components_expanded';

// Управление развернутостью проектов
const {
  expanded,
  loadExpandedState: loadProjectsExpandedState,
  cleanupExpandedByKeys: cleanupProjectsExpanded,
  toggleExpanded: toggleProjectExpanded,
} = useExpandableState(PROJECTS_EXPANDED_KEY);

// Управление развернутостью компонентов
const {
  expanded: expandedComponents,
  loadExpandedState: loadComponentsExpandedState,
  toggleExpanded: toggleComponentExpanded,
} = useExpandableState(COMPONENTS_EXPANDED_KEY);

// Состояние для подсчета общего количества элементов
const totalProjectsCount = ref(0);
const totalComponentsCount = ref(0);

// Текущее состояние пагинации для poll обновлений
const currentPage = ref(1);
const currentRowsPerPage = ref(25);
const currentSortBy = ref('_created_at');
const currentDescending = ref(true);

// Количество компонентов теперь подсчитывается в handleProjectsDataLoaded


const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleComponentToggle = (componentHash: string) => {
  toggleComponentExpanded(componentHash);
};

const handleOpenProject = (projectHash: string) => {
  router.push({ name: 'project-description', params: { project_hash: projectHash }, query: { _backRoute: 'projects-list' } });
};

const handleProjectsDataLoaded = (projectHashes: string[], totalComponents?: number) => {
  // Очищаем устаревшие записи expanded проектов после загрузки данных
  cleanupProjectsExpanded(projectHashes);

  // Сохраняем количество проектов для indeterminate логики
  totalProjectsCount.value = projectHashes.length;

  // Сохраняем общее количество компонентов
  if (totalComponents !== undefined) {
    totalComponentsCount.value = totalComponents;
  }
};

const handlePaginationChanged = (paginationData: { page: number; rowsPerPage: number; sortBy: string; descending: boolean }) => {
  // Сохраняем текущую пагинацию для poll обновлений
  currentPage.value = paginationData.page;
  currentRowsPerPage.value = paginationData.rowsPerPage;
  currentSortBy.value = paginationData.sortBy;
  currentDescending.value = paginationData.descending;
};

// Очищаем данные проектов перед монтированием, чтобы не было мелькания старых данных
onBeforeMount(() => {
  projectStore.projects = {
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  };
});

// Регистрируем действия в header
onMounted(async () => {
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadProjectsExpandedState();
  loadComponentsExpandedState();

  // Регистрируем кнопку фильтров в header
  registerHeaderAction(filterButton.value);
});

// Следим за изменениями фильтров и обновляем список
watch(() => projectStore.projectFilters, () => {
  projectsListKey.value++;
}, { deep: true });

// Очищаем кнопки при уходе со страницы
onBeforeUnmount(() => {
  clearActions();
});


</script>

<style lang="scss" scoped>
.q-chip {
  font-weight: 500;
}
</style>
