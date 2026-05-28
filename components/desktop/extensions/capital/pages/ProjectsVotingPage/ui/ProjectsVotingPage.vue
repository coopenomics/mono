<template lang="pug">
div
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных голосования...')
  q-card(v-show='!isInitialLoading', flat)
    div
      // Виджет списка проектов на голосовании
      ListVotingProjectWidget(
        :coopname='info.coopname',
        :expanded='expandedProjects',
        @toggle-expand='handleProjectToggleExpand',
        @project-click='handleProjectClick',
        @data-loaded='handleProjectsDataLoaded'
        @projects-loaded='handleProjectsLoaded'
      )
        template(#project-content='{ project }')
          // Виджет участников голосования
          ProjectVotingSegmentsWidget(
            :project-hash='project.project_hash',
            :coopname='info.coopname',
            :expanded='expandedSegments',
            :project='project',
            :current-username='username',
            :segments-to-reload='segmentsToReload',
            @toggle-expand='handleSegmentToggleExpand',
            @segment-click='handleSegmentClick',
            @data-loaded='handleSegmentsDataLoaded',
            @votes-changed='handleVotesChanged'
          )
            template(#segment-content='{ segment, segmentsToReload }')
              // Виджет голосов участника
              SegmentVotesWidget(
                :project-hash='project.project_hash',
                :coopname='info.coopname',
                :segment-username='segment.username',
                :segment-display-name='segment.display_name',
                :force-reload='segmentsToReload[segment.username]'
              )
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useExpandableState, useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { WindowLoader } from 'src/shared/ui/Loader';
import { ListVotingProjectWidget, ProjectVotingSegmentsWidget, SegmentVotesWidget } from 'app/extensions/capital/widgets';
import { useSessionStore } from 'src/entities/Session';
import { Zeus } from '@coopenomics/sdk';

const { info } = useSystemStore();

const { username } = useSessionStore();
// Ключи для сохранения состояния в LocalStorage
const PROJECTS_EXPANDED_KEY = 'capital_voting_projects_expanded';
const SEGMENTS_EXPANDED_KEY = 'capital_voting_segments_expanded';

// Состояние первичной загрузки (WindowLoader)
const isInitialLoading = ref(true);

// Состояние для отслеживания сегментов, которые нужно обновить
const segmentsToReload = ref<Record<string, number>>({});

// Управление развернутостью проектов
const {
  expanded: expandedProjects,
  loadExpandedState: loadProjectsExpandedState,
  cleanupExpandedByKeys: cleanupProjectsExpanded,
  toggleExpanded: toggleProjectExpanded,
} = useExpandableState(PROJECTS_EXPANDED_KEY);

// Управление развернутостью сегментов (участников)
const {
  expanded: expandedSegments,
  loadExpandedState: loadSegmentsExpandedState,
  cleanupExpandedByKeys: cleanupSegmentsExpanded,
  toggleExpanded: toggleSegmentExpanded,
} = useExpandableState(SEGMENTS_EXPANDED_KEY);

const handleProjectClick = (projectHash: string) => {
  // Клик на строку проекта приводит к развороту/свертыванию
  toggleProjectExpanded(projectHash);
};

const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleSegmentToggleExpand = (username: string) => {
  toggleSegmentExpanded(username);
};

const handleProjectsDataLoaded = (projectHashes: string[]) => {
  // Очищаем устаревшие записи expanded проектов после загрузки данных
  cleanupProjectsExpanded(projectHashes);

  // Отключаем WindowLoader после завершения первичной загрузки
  isInitialLoading.value = false;
};

const handleProjectsLoaded = (projects: any[]) => {
  // Автоматически раскрываем все активные голосования
  projects.forEach(project => {
    const status = String(project.status);
    if (status === Zeus.ProjectStatus.VOTING) {
      expandedProjects.value[project.project_hash] = true;
    }
  });
};

const handleSegmentsDataLoaded = (usernames: string[]) => {
  // Очищаем устаревшие записи expanded сегментов после загрузки данных
  cleanupSegmentsExpanded(usernames);
};

const handleSegmentClick = (username: string) => {
  // Клик на строку сегмента приводит к развороту/свертыванию
  toggleSegmentExpanded(username);
};

const handleVotesChanged = (data: { projectHash: string; voter: string }) => {
  // Помечаем сегмент для перезагрузки (используем timestamp как уникальный ключ)
  segmentsToReload.value[data.voter] = Date.now();
};

/**
 * Функция для перезагрузки данных голосования
 * Используется для poll обновлений
 */
const reloadVotingData = async () => {
  try {
    // Для голосований используем принудительную перезагрузку через timestamp
    // Это заставит виджеты перезагрузить данные
    const timestamp = Date.now();

    // Обновляем все сегменты для перезагрузки
    Object.keys(segmentsToReload.value).forEach(key => {
      segmentsToReload.value[key] = timestamp;
    });

    // Если нет сегментов, добавляем специальный ключ для принудительной перезагрузки
    if (Object.keys(segmentsToReload.value).length === 0) {
      segmentsToReload.value['__force_reload__'] = timestamp;
    }
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных голосования в poll:', error);
  }
};

// Настраиваем poll обновление данных
const { start: startVotingPoll, stop: stopVotingPoll } = useDataPoller(
  reloadVotingData,
  { interval: POLL_INTERVALS.FAST, immediate: false }
);

// Инициализация
onMounted(async () => {
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadProjectsExpandedState();
  loadSegmentsExpandedState();

  // Запускаем poll обновление данных
  startVotingPoll();
});

// Останавливаем poll при уходе со страницы
onBeforeUnmount(() => {
  stopVotingPoll();
});
</script>
