<template lang="pug">
div
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных результатов...')
  q-card(v-show='!isInitialLoading', flat)
    // Заглушка для проектов, которые не готовы к приему результатов
    div(v-show='!canShowResults')
      .text-center.q-pa-xl
        q-icon(name='hourglass_empty', size='4rem', color='grey-5')
        .q-mt-md
          .text-h6.text-grey-7 Проект еще не готов к приему результатов
          .text-body2.text-grey-6.q-mt-sm
            | Результаты можно будет отправить после завершения голосования и расчета результатов.
            br
            | Следите за статусом проекта.

    // Контент для проектов в статусе FINALIZED или RESULT
    div(v-show='canShowResults')
      // Информация о стоимостях

      q-card-section(v-if='project && project.fact')
        .row.q-gutter-sm.justify-center.q-py-sm
          ColorCard(color="blue")
            .card-label Стоимость Генерации ({{ calcShare(project, 'total_generation_pool') }}%)
            .card-value {{ formatAsset2Digits(project.fact?.total_generation_pool || `0 ${info.symbols.root_govern_symbol}`) }}

          ColorCard(color="teal")
            .card-label Стоимость Благороста ({{ calcShare(project, 'contributors_bonus_pool') }}%)
            .card-value {{ formatAsset2Digits(project.fact?.contributors_bonus_pool || `0 ${info.symbols.root_govern_symbol}`) }}

          ColorCard(color="purple")
            .card-label Стоимость ОАП (100.00%)
            .card-value {{ formatAsset2Digits(project.fact?.total || `0 ${info.symbols.root_govern_symbol}`) }}
        hr
      // Виджет сегментов пользователя для результатов
      ResultSubmissionSegmentsWidget(
        :project-hash='projectHash'
        :coopname='info.coopname'
        :expanded='expandedSegments'
        :project='project || undefined'
        @toggle-expand='handleSegmentToggleExpand'
        @segment-click='handleSegmentClick'
        @data-loaded='handleSegmentsDataLoaded'
      )
        template(#actions='{ segment }')
          ResultSubmissionActionsWidget(
            :segment='segment'
            @segment-updated='handleSegmentUpdated'
          )
</template>

<script lang="ts" setup>
import { onMounted, ref, computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useExpandableState } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { ResultSubmissionSegmentsWidget, ResultSubmissionActionsWidget } from 'app/extensions/capital/widgets';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils';

const { info } = useSystemStore();
const segmentStore = useSegmentStore();

// Используем composable для загрузки проекта
const { project, projectHash, loadProject } = useProjectLoader();

// Ключ для сохранения состояния в LocalStorage
const SEGMENTS_EXPANDED_KEY = 'capital_component_results_segments_expanded';

// Состояние первичной загрузки (WindowLoader)
const isInitialLoading = ref(true);

// Управление развернутостью сегментов (участников)
const {
  expanded: expandedSegments,
  loadExpandedState: loadSegmentsExpandedState,
  cleanupExpandedByKeys: cleanupSegmentsExpanded,
  toggleExpanded: toggleSegmentExpanded,
} = useExpandableState(SEGMENTS_EXPANDED_KEY);

// Проверка, можно ли показывать результаты (только для статусов FINALIZED и RESULT)
const canShowResults = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return status === Zeus.ProjectStatus.FINALIZED || status === Zeus.ProjectStatus.RESULT;
});


const handleSegmentToggleExpand = (username: string) => {
  toggleSegmentExpanded(username);
};

const handleSegmentsDataLoaded = (usernames: string[]) => {
  // Очищаем устаревшие записи expanded сегментов после загрузки данных
  cleanupSegmentsExpanded(usernames);

  // Отключаем WindowLoader после завершения первичной загрузки
  isInitialLoading.value = false;
};

const handleSegmentUpdated = async (segment: ISegment) => {
  // Перезагружаем сегменты компонента, к которому принадлежит обновленный сегмент
  try {
    await segmentStore.loadSegments({
      filter: {
        coopname: info.coopname,
        project_hash: segment.project_hash,
      },
      options: {
        page: 1,
        limit: 1000,
        sortOrder: 'ASC',
      },
    });
  } catch (error) {
    console.error('Ошибка при перезагрузке сегментов после обновления:', error);
  }
};

const handleSegmentClick = (username: string) => {
  // Клик на строку сегмента приводит к развороту/свертыванию
  toggleSegmentExpanded(username);
};

const calcShare = (project: any, fieldName: string) => {
  const value = project.fact?.[fieldName];
  const total = project.fact?.total;

  if (!value || !total) return '0.00';

  const valueNum = parseFloat(value.split(' ')[0] || '0');
  const totalNum = parseFloat(total.split(' ')[0] || '1');

  if (totalNum === 0) return '0.00';

  const percentage = (valueNum / totalNum) * 100;
  return percentage.toFixed(2);
};

// Инициализация
onMounted(async () => {
  // Загружаем данные проекта (если еще не загружены)
  await loadProject();

  // Загружаем сохраненное состояние expanded из LocalStorage
  loadSegmentsExpandedState();
});
</script>
