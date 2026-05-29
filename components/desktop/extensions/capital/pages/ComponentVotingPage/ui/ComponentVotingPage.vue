<template lang="pug">
div

  WindowLoader(v-show='isInitialLoading', text='Загрузка данных голосования...')

  q-card(v-show='!isInitialLoading', flat)
    // Заглушка для проектов, которые не готовы к голосованию
    div(v-show='!canShowVoting')
      .text-center.q-pa-xl
        q-icon(name='how_to_vote', size='4rem', color='grey-5')
        .q-mt-md
          .text-h6.text-grey-7 Голосование еще не началось
          .text-body2.text-grey-6.q-mt-sm
            | Голосование будет доступно после завершения работы над проектом.
            br
            | Следите за статусом проекта на странице описания.

    // Контент для проектов в статусе FINALIZED, RESULT или VOTING
    div(v-show='canShowVoting')

      // Отображение голосующей суммы и суммы на распределении
      q-card-section(v-if='project && project.voting?.amounts')
        .row.q-gutter-sm.justify-center.q-py-sm
          ColorCard(color='blue')
            .card-label На распределении
            .card-value {{ formatAsset2Digits(project.voting.amounts.total_voting_pool || '0') }}
          ColorCard(color='purple', v-if='!isVotingCompleted(project)')
            .card-label Голосующая сумма
            .card-value {{ formatAsset2Digits(project.voting.amounts.active_voting_amount || '0') }}
        hr
      div
        // Виджет участников голосования
        ProjectVotingSegmentsWidget(
          :project-hash='projectHash'
          :coopname='info.coopname'
          :expanded='expandedSegments'
          :project='project || undefined'
          :current-username='username'
          :segments-to-reload='segmentsToReload'
          @toggle-expand='handleSegmentToggleExpand'
          @segment-click='handleSegmentClick'
          @data-loaded='handleSegmentsDataLoaded'
          @votes-changed='handleVotesChanged'
        )
          template(#segment-content='{ segment, segmentsToReload }')
            // Виджет голосов участника
            SegmentVotesWidget(
              :project-hash='projectHash'
              :coopname='info.coopname'
              :segment-username='segment.username'
              :segment-display-name='segment.display_name'
              :force-reload='segmentsToReload[segment.username]'
            )
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useExpandableState, useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { WindowLoader } from 'src/shared/ui/Loader';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { ProjectVotingSegmentsWidget, SegmentVotesWidget } from 'app/extensions/capital/widgets';
import { useSessionStore } from 'src/entities/Session';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { formatAsset2Digits} from 'src/shared/lib/utils/formatAsset2Digits';
import { Zeus } from '@coopenomics/sdk';

const { info } = useSystemStore();
const { username } = useSessionStore();

// Используем composable для загрузки проекта
const { project, projectHash, loadProject } = useProjectLoader();

// Проверка, можно ли показывать голосование (для статусов FINALIZED, RESULT и VOTING)
const canShowVoting = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return status === Zeus.ProjectStatus.FINALIZED ||
         status === Zeus.ProjectStatus.RESULT ||
         status === Zeus.ProjectStatus.VOTING;
});

// Проверка, завершено ли голосование для проекта
const isVotingCompleted = (project: any) => {
  if (!project) return false;

  const status = String(project.status);
  const voting = project.voting;

  if (status === Zeus.ProjectStatus.RESULT || status === 'RESULT') return true;
  if (voting && voting.votes_received === voting.total_voters) return true;

  return false;
};

// Ключ для сохранения состояния в LocalStorage
const SEGMENTS_EXPANDED_KEY = 'capital_component_voting_segments_expanded';

// Состояние первичной загрузки (WindowLoader)
const isInitialLoading = ref(true);

// Состояние для отслеживания сегментов, которые нужно обновить
const segmentsToReload = ref<Record<string, number>>({});

// Управление развернутостью сегментов (участников)
const {
  expanded: expandedSegments,
  loadExpandedState: loadSegmentsExpandedState,
  cleanupExpandedByKeys: cleanupSegmentsExpanded,
  toggleExpanded: toggleSegmentExpanded,
} = useExpandableState(SEGMENTS_EXPANDED_KEY);

const handleSegmentToggleExpand = (username: string) => {
  toggleSegmentExpanded(username);
};

const handleSegmentsDataLoaded = (usernames: string[]) => {
  // Очищаем устаревшие записи expanded сегментов после загрузки данных
  cleanupSegmentsExpanded(usernames);

  // Отключаем WindowLoader после завершения первичной загрузки
  isInitialLoading.value = false;
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
  // Загружаем проект явно
  await loadProject();

  // Загружаем сохраненное состояние expanded из LocalStorage
  loadSegmentsExpandedState();

  // Запускаем poll обновление данных
  startVotingPoll();
});

// Останавливаем poll при уходе со страницы
onBeforeUnmount(() => {
  stopVotingPoll();
});
</script>
