<template lang="pug">
//- Моё время: surface + агрегаты WalletCard сверху + плоский аккордеон без ColorCard.
.tracker-page
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных трекера...')
  .tracker-page__body(v-show='!isInitialLoading')
    .banner.banner--info(v-if='!bannerDismissed')
      q-icon.banner__icon(name='info', size='20px')
      .banner__body
        | Билеты времени становятся доступны для коммита после перевода задачи в статус «выполнена».
        | Дробная часть часа сохраняется в учёте до следующего накопления полного часа.
      BaseButton.banner__dismiss(
        variant='ghost',
        size='sm',
        icon-only,
        aria-label='Скрыть подсказку',
        @click='dismissBanner'
      )
        template(#icon-left)
          q-icon(name='close')

    ActiveTimerWidget(
      :coopname='info.coopname',
      :username='username'
    )

    .row.q-col-gutter-md
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='Доступно',
          :balance='aggregates.available',
          symbol='ч',
          balance-label='к коммиту по всем компонентам',
          icon='schedule',
          :loading='isInitialLoading'
        )
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='В ожидании',
          :balance='aggregates.pending',
          symbol='ч',
          balance-label='ожидают подтверждения',
          icon='hourglass_empty',
          :loading='isInitialLoading'
        )
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='Подтверждено',
          :balance='aggregates.committed',
          symbol='ч',
          balance-label='зафиксировано в учёте',
          icon='verified',
          :loading='isInitialLoading'
        )

    TimeStatsWidget(
      :coopname='info.coopname',
      :username='username',
      :expanded='expandedProjects',
      @toggle-expand='handleProjectToggleExpand',
      @project-click='handleProjectClick',
      @data-loaded='handleProjectsDataLoaded'
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
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model/store';
import { useExpandableState } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { BaseButton } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { useTimeStatsStore } from 'app/extensions/capital/entities/TimeStats/model';
import { TimeStatsWidget, TimeIssuesWidget, TimeEntriesWidget, ActiveTimerWidget } from 'app/extensions/capital/widgets';

const BANNER_KEY = 'capital_tracker_banner_dismissed';
const PROJECTS_EXPANDED_KEY = 'capital_tracker_projects_expanded';
const ISSUES_EXPANDED_KEY = 'capital_tracker_issues_expanded';

const { info } = useSystemStore();
const { username } = useSessionStore();
const timeStatsStore = useTimeStatsStore();
const { timeStats } = storeToRefs(timeStatsStore);

const isInitialLoading = ref(true);
const bannerDismissed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(BANNER_KEY) === '1',
);

const {
  expanded: expandedProjects,
  loadExpandedState: loadProjectsExpandedState,
  cleanupExpandedByKeys: cleanupProjectsExpanded,
  toggleExpanded: toggleProjectExpanded,
} = useExpandableState(PROJECTS_EXPANDED_KEY);

const {
  expanded: expandedIssues,
  loadExpandedState: loadIssuesExpandedState,
  cleanupExpandedByKeys: cleanupIssuesExpanded,
  toggleExpanded: toggleIssueExpanded,
} = useExpandableState(ISSUES_EXPANDED_KEY);

function formatMetric(hours: number): string {
  const n = hours || 0;
  return n % 1 === 0 ? String(n) : String(parseFloat(n.toFixed(1)));
}

const aggregates = computed(() => {
  const items = timeStats.value?.items ?? [];
  let available = 0;
  let pending = 0;
  let committed = 0;
  for (const item of items) {
    available += item.available_hours || 0;
    pending += item.pending_hours || 0;
    committed += item.total_committed_hours || 0;
  }
  return {
    available: formatMetric(available),
    pending: formatMetric(pending),
    committed: formatMetric(committed),
  };
});

function dismissBanner() {
  bannerDismissed.value = true;
  localStorage.setItem(BANNER_KEY, '1');
}

const handleProjectClick = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleIssueToggleExpand = (issueHash: string) => {
  toggleIssueExpanded(issueHash);
};

const handleProjectsDataLoaded = (projectHashes: string[]) => {
  cleanupProjectsExpanded(projectHashes);
  isInitialLoading.value = false;
};

const handleIssuesDataLoaded = (issueHashes: string[]) => {
  cleanupIssuesExpanded(issueHashes);
};

const handleIssueClick = (issueHash: string) => {
  toggleIssueExpanded(issueHash);
};

onMounted(() => {
  loadProjectsExpandedState();
  loadIssuesExpandedState();
});
</script>

<style lang="scss" scoped>
.tracker-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
}

.tracker-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  flex: 1;
  min-height: 0;
}

.banner__dismiss {
  flex-shrink: 0;
  margin-left: auto;
}

@media (max-width: 768px) {
  .tracker-page {
    padding: var(--p-4);
  }
}
</style>
