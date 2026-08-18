<template lang="pug">
//- Родитель кооперативных проектов: список на корне, проект/компонент/задача — children через router-view
//- (подсветка «Кооперативные проекты» в рейле через matched по name projects-list).
router-view(v-if='!isWorkshopRoot')
.projects-list-page(v-else)
  //- Фильтры живут кнопкой в шапке (FilterDialogWithButton), отдельной
  //- панели на странице нет

  // Виджет списка проектов
  ProjectsListWidget(
    :key='projectsListKey',
    :expanded='expanded',
    :statuses='projectStatuses',
    :priorities='projectPriorities',
    :master='master',
    :sort-by='sort.sortBy',
    :sort-order='sort.sortOrder',
    @toggle-expand='handleProjectToggleExpand',
    @data-loaded='handleProjectsDataLoaded',
    @open-project='handleOpenProject'
    @pagination-changed='handlePaginationChanged'
  )
    template(#project-content='{ project }')
      //- Компоненты приходят вложенными без ORDER BY — сортируем тем же полем локально
      ComponentsListWidget(
        :components='sortCapitalList(project.components, sort.sortBy, sort.sortOrder)',
        :project='project',
        :expanded='expandedComponents',
        @open-component='(componentHash) => router.push({ name: "component-description", params: { project_hash: componentHash }, query: { _backRoute: "projects-list" } })',
        @toggle-component='handleComponentToggle'
      )
        template(#component-content='{ component }')
          IssuesListWidget(
            :project-hash='component.project_hash',
            :can-manage-issues='!!component.permissions?.can_manage_issues',
            :compact='true',
            :sort-by='sort.sortBy',
            :sort-order='sort.sortOrder',
            @issue-click='(issue) => router.push({ name: "component-issue", params: { project_hash: issue.project_hash, issue_hash: issue.issue_hash }, query: { _backRoute: "projects-list" } })'
          )


</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onBeforeUnmount, ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useExpandableState } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { CreateProjectHeaderButton } from 'app/extensions/capital/features/Project/CreateProject';
import { FilterDialogWithButton, SortMenuButton } from 'app/extensions/capital/shared/ui';
import { useListPreferences, sortCapitalList } from 'app/extensions/capital/shared/lib';
import { ProjectsListWidget, ComponentsListWidget, IssuesListWidget } from 'app/extensions/capital/widgets';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useSessionStore } from 'src/entities/Session';
import { useCapitalFabHotkeys } from 'app/extensions/capital/shared/lib';

const router = useRouter();
const route = useRoute();
const session = useSessionStore();

/** Корень списка кооперативных проектов, не вложенный проект/компонент/задача. */
const isWorkshopRoot = computed(() => route.name === 'projects-list');

// openDialog кнопки-в-шапке прилетает колбэком (см. CreateProjectHeaderButton)
const openProjectDialog = ref<(() => void) | null>(null);
const capitalFabHotkeysEnabled = computed(
  () => isWorkshopRoot.value && (session.isChairman || session.isMember),
);

useCapitalFabHotkeys(
  () => ({
    project: () => openProjectDialog.value?.(),
  }),
  { enabled: capitalFabHotkeysEnabled },
);

const projectStore = useProjectStore();

// Фильтры и сортировка списка — общие с кнопками в шапке, переживают перезагрузку
const { filters, sort } = useListPreferences('projects');

// Фильтруем сами проекты: задачи внутри дерева не отсеиваем, для них есть
// отдельный раздел «Задачи» со своими фильтрами
const projectStatuses = computed(() => filters.value.entityStatuses);
const projectPriorities = computed(() => filters.value.entityPriorities);
const master = computed(() => filters.value.master);

const projectsListKey = ref(0);

// Регистрируем главное действие страницы в header
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

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

function registerListHeaderActions(): void {
  registerHeaderAction({
    id: 'capital-projects-filter',
    component: FilterDialogWithButton,
    props: { scope: 'projects' },
    order: 2,
  });
  registerHeaderAction({
    id: 'capital-projects-sort',
    component: SortMenuButton,
    props: { scope: 'projects' },
    order: 3,
  });

  if (!(session.isChairman || session.isMember)) return;
  registerHeaderAction({
    id: 'capital-projects-create',
    component: CreateProjectHeaderButton,
    props: {
      exposeOpen: (fn: () => void) => {
        openProjectDialog.value = fn;
      },
    },
    order: 1,
  });
}

// Регистрируем действия в header только на корне списка
onMounted(async () => {
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadProjectsExpandedState();
  loadComponentsExpandedState();

  if (isWorkshopRoot.value) {
    registerListHeaderActions();
  }
});

// При уходе во вложенный маршрут / возврате на список — шапка списка
watch(isWorkshopRoot, (isRoot) => {
  if (isRoot) registerListHeaderActions();
  else clearActions();
});

// Следим за изменениями фильтров и обновляем список
watch([filters, sort], () => {
  if (!isWorkshopRoot.value) return;
  projectsListKey.value++;
}, { deep: true });

// Очищаем кнопки при уходе со страницы
onBeforeUnmount(() => {
  clearActions();
});


</script>

<style lang="scss" scoped>
// Flex-колонка: панель фильтров сверху, список занимает остаток вьюпорта,
// скролл живёт внутри списка (virtual-scroll), низ не уезжает за экран
.projects-list-page {
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

