<template lang="pug">
div
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных трекера...')
  q-card(v-show='!isInitialLoading', flat)
    div
      // Виджет статистики по проектам
      TimeStatsWidget(
        :coopname='info.coopname',
        :username='username',
        :expanded='expandedProjects',
        :force-reload='forceReload',
        @toggle-expand='handleProjectToggleExpand',
        @project-click='handleProjectClick',
        @data-loaded='handleProjectsDataLoaded'
        @pagination-changed='handlePaginationChanged'
      )
        template(#project-content='{ project }')
          TimeIssuesWidget(
            :project-hash='project.project_hash',
            :coopname='info.coopname',
            :username='username',
            :expanded='expandedIssues',
            :show-name='false',
            @toggle-expand='handleIssueToggleExpand',
            @issue-click='handleIssueClick',
            @data-loaded='handleIssuesDataLoaded'
          )
            template(#issue-content='{ issue }')
              TimeEntriesWidget(
                :issue-hash='issue.issue_hash',
                :coopname='info.coopname',
                :username='username'
              )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model/store';
import { useExpandableState } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { TimeStatsWidget, TimeIssuesWidget, TimeEntriesWidget } from 'app/extensions/capital/widgets';

const { info } = useSystemStore();
const { username } = useSessionStore();

// Ключи для сохранения состояния в LocalStorage
const PROJECTS_EXPANDED_KEY = 'capital_tracker_projects_expanded';
const ISSUES_EXPANDED_KEY = 'capital_tracker_issues_expanded';

// Состояние первичной загрузки (WindowLoader)
const isInitialLoading = ref(true);

// Счетчик загруженных виджетов для корректного отключения WindowLoader
const loadedWidgetsCount = ref(0);

// Состояние для принудительной перезагрузки данных
const forceReload = ref(0);

// Текущее состояние пагинации для poll обновлений
const currentPage = ref(1);
const currentRowsPerPage = ref(100);
const currentSortBy = ref('project_name');
const currentSortOrder = ref('ASC');

// Управление развернутостью проектов
const {
  expanded: expandedProjects,
  loadExpandedState: loadProjectsExpandedState,
  cleanupExpandedByKeys: cleanupProjectsExpanded,
  toggleExpanded: toggleProjectExpanded,
} = useExpandableState(PROJECTS_EXPANDED_KEY);

// Управление развернутостью задач
const {
  expanded: expandedIssues,
  loadExpandedState: loadIssuesExpandedState,
  cleanupExpandedByKeys: cleanupIssuesExpanded,
  toggleExpanded: toggleIssueExpanded,
} = useExpandableState(ISSUES_EXPANDED_KEY);

const handleProjectClick = (projectHash: string) => {
  // Клик на строку проекта приводит к развороту/свертыванию
  toggleProjectExpanded(projectHash);
};

const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleIssueToggleExpand = (issueHash: string) => {
  toggleIssueExpanded(issueHash);
};

const handleProjectsDataLoaded = (projectHashes: string[]) => {
  // Очищаем устаревшие записи expanded проектов после загрузки данных
  cleanupProjectsExpanded(projectHashes);

  // Отключаем WindowLoader после завершения первичной загрузки проектов
  loadedWidgetsCount.value += 1;
  if (loadedWidgetsCount.value >= 1) { // Ждем загрузку проектов
    isInitialLoading.value = false;
  }
};

const handleIssuesDataLoaded = (issueHashes: string[]) => {
  // Очищаем устаревшие записи expanded задач после загрузки данных
  cleanupIssuesExpanded(issueHashes);
};

const handleIssueClick = (issueHash: string) => {
  // Клик на строку задачи приводит к развороту/свертыванию
  toggleIssueExpanded(issueHash);
};

const handlePaginationChanged = (paginationData: { page: number; rowsPerPage: number; sortBy: string; sortOrder: string }) => {
  // Сохраняем текущую пагинацию для poll обновлений
  currentPage.value = paginationData.page;
  currentRowsPerPage.value = paginationData.rowsPerPage;
  currentSortBy.value = paginationData.sortBy;
  currentSortOrder.value = paginationData.sortOrder;
};


// Инициализация
onMounted(async () => {
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadProjectsExpandedState();
  loadIssuesExpandedState();
});

</script>
