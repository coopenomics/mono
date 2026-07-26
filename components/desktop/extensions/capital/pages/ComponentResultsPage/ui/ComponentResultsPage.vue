<template lang="pug">
.results-page(:class='{ "results-page--standalone": isStandaloneResults }')
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных результатов...')

  .results-page__body(v-show='!isInitialLoading')
    .results-page__nav(v-if='isStandaloneResults')
      BaseButton(variant='ghost', size='sm', @click='goBack')
        template(#icon-left)
          q-icon(name='arrow_back')
        | К результатам

    EmptyState(
      v-if='!canShowResults',
      title='Проект ещё не готов к приёмке результатов',
      body='Результаты можно отправить после завершения голосования и расчёта. Следите за статусом на странице описания.'
    )
      template(#icon)
        q-icon(name='hourglass_empty')

    template(v-else)
      //- Секция 1: контекст и сводка стоимостей
      section.results-page__section.results-page__section--info
        .results-page__panel.results-page__panel--summary
          .results-page__head(v-if='isStandaloneResults && project')
            .results-page__title-row
              h2.results-page__title {{ project.title }}
              BaseBadge(:variant='statusVariant') {{ statusLabel }}
            .results-page__parent.t-sm.t-muted(v-if='project.parent_title')
              q-icon(name='folder', size='14px')
              span {{ project.parent_title }}

          .results-page__metrics(v-if='project && project.fact')
            WalletCard(
              compact,
              program='generator',
              title='Стоимость Генерации',
              :balance='formatMoneyAmount(project.fact.total_generation_pool)',
              :symbol='governSymbol',
              :balance-label='`${calcShare("total_generation_pool")}%`',
              icon='bolt'
            )
            WalletCard(
              compact,
              program='blagorost',
              title='Стоимость Благороста',
              :balance='formatMoneyAmount(project.fact.contributors_bonus_pool)',
              :symbol='governSymbol',
              :balance-label='`${calcShare("contributors_bonus_pool")}%`',
              icon='spa'
            )
            WalletCard(
              compact,
              neutral,
              title='Стоимость ОАП',
              :balance='formatMoneyAmount(project.fact.total)',
              :symbol='governSymbol',
              balance-label='100%',
              icon='account_balance'
            )

      //- Секция 2: участники и действия
      section.results-page__section.results-page__section--participants
        .results-page__section-head
          .results-page__section-label
            q-icon(name='group', size='18px')
            span.t-eyebrow Участники
          h3.results-page__section-title Внесение результатов
        .results-page__panel
          ResultSubmissionSegmentsWidget(
            :project-hash='projectHash',
            :coopname='info.coopname',
            :expanded='expandedSegments',
            :project='project || undefined',
            @toggle-expand='handleSegmentToggleExpand',
            @segment-click='handleSegmentClick',
            @data-loaded='handleSegmentsDataLoaded'
          )
            template(#actions='{ segment }')
              ResultSubmissionActionsWidget(
                :segment='segment',
                @segment-updated='handleSegmentUpdated'
              )
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useExpandableState } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { EmptyState, BaseButton, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import {
  ResultSubmissionSegmentsWidget,
  ResultSubmissionActionsWidget,
} from 'app/extensions/capital/widgets';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getProjectStatusLabel } from 'app/extensions/capital/shared/lib/projectStatus';
import { Zeus } from '@coopenomics/sdk';

const route = useRoute();
const router = useRouter();
const { info } = useSystemStore();
const segmentStore = useSegmentStore();
const desktopStore = useDesktopStore();
const { project, projectHash, loadProject } = useProjectLoader();

/** Открыто со списка «Результаты», а не как вкладка компонента */
const isStandaloneResults = computed(() => route.name === 'results-detail');

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const canShowResults = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return (
    status === Zeus.ProjectStatus.FINALIZED ||
    status === Zeus.ProjectStatus.RESULT
  );
});

const statusLabel = computed(() =>
  getProjectStatusLabel(String(project.value?.status || '')),
);

const statusVariant = computed<BaseBadgeVariant>(() => {
  const status = String(project.value?.status || '');
  if (status === Zeus.ProjectStatus.RESULT) return 'pos';
  if (status === Zeus.ProjectStatus.FINALIZED) return 'neutral';
  if (status === Zeus.ProjectStatus.CANCELLED) return 'neg';
  return 'info';
});

function calcShare(fieldName: string) {
  const value = (project.value?.fact as any)?.[fieldName];
  const total = project.value?.fact?.total;
  if (!value || !total) return '0.00';

  const valueNum = parseFloat(String(value).split(' ')[0] || '0');
  const totalNum = parseFloat(String(total).split(' ')[0] || '1');
  if (totalNum === 0) return '0.00';

  return ((valueNum / totalNum) * 100).toFixed(2);
}

function formatMoneyAmount(raw: string | number | undefined): string {
  const src =
    typeof raw === 'string' && /\s[A-Z]{3,7}$/.test(raw.trim())
      ? raw
      : `${raw || 0} ${governSymbol.value}`;
  const formatted = formatAsset2Digits(src);
  return formatted.replace(/\s*[A-Z]{3,7}\s*$/, '').trim() || '0,00';
}

const goBack = () => {
  const back = route.query._backRoute as string | undefined;
  if (back) {
    router.push({ name: back });
    return;
  }
  router.push({ name: 'results' });
};

const SEGMENTS_EXPANDED_KEY = 'capital_component_results_segments_expanded';
const isInitialLoading = ref(true);

const {
  expanded: expandedSegments,
  loadExpandedState: loadSegmentsExpandedState,
  cleanupExpandedByKeys: cleanupSegmentsExpanded,
  toggleExpanded: toggleSegmentExpanded,
} = useExpandableState(SEGMENTS_EXPANDED_KEY);

const handleSegmentToggleExpand = (uname: string) => {
  toggleSegmentExpanded(uname);
};

const handleSegmentsDataLoaded = (usernames: string[]) => {
  cleanupSegmentsExpanded(usernames);
  isInitialLoading.value = false;
};

const handleSegmentClick = (uname: string) => {
  toggleSegmentExpanded(uname);
};

const handleSegmentUpdated = async (segment: ISegment) => {
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

watch(
  () => project.value?.title,
  (title) => {
    if (isStandaloneResults.value && title) {
      desktopStore.setPageTitleOverride(title);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadProject();
  loadSegmentsExpandedState();
  if (!canShowResults.value) {
    isInitialLoading.value = false;
  }
});

onBeforeUnmount(() => {
  if (isStandaloneResults.value) {
    desktopStore.clearPageTitleOverride();
  }
});
</script>

<style lang="scss" scoped>
.results-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-width: 0;
  box-sizing: border-box;

  &--standalone {
    min-height: calc(100vh - var(--p-topbar-h));
  }
}

.results-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-7);
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.results-page__nav {
  display: flex;
  align-items: center;
}

.results-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;

  &--participants {
    gap: var(--p-3);
  }
}

.results-page__section-head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.results-page__section-label {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-2);

  .q-icon {
    color: var(--p-primary);
  }
}

.results-page__section-title {
  margin: 0;
  font-size: var(--p-fs-h4, 1.05rem);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}

.results-page__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.results-page__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
}

.results-page__title {
  margin: 0;
  font-size: var(--p-fs-h3, 1.25rem);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}

.results-page__parent {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}

.results-page__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--p-3);
}

.results-page__panel {
  min-width: 0;
  padding: var(--p-2) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);

  &--summary {
    display: flex;
    flex-direction: column;
    gap: var(--p-4);
    padding: var(--p-5);
  }
}

@media (max-width: 768px) {
  .results-page {
    padding: var(--p-4);
  }

  .results-page__body {
    gap: var(--p-5);
  }

  .results-page__panel {
    padding: var(--p-1) var(--p-4);

    &--summary {
      padding: var(--p-4);
    }
  }
}
</style>
