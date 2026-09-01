<template lang="pug">
//- Коммиты: «Моё время» | «Мои коммиты» | «На проверке»; PageTabs на canvas.
.commits-page-shell.page-shell.column.flex-1.min-h-0.min-w-0.no-wrap
  PageTabs(
    :tabs='tabs',
    :active-key='activeTab',
    @select='onSelectTab'
  )

  .page-surface.commits-page__body.col.flex-1.min-h-0.min-w-0
    //- Моё время: карточки + дерево часов к коммиту
    template(v-if='activeTab === "time"')
      .row.q-col-gutter-md
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='Доступно',
            :balance='timeAggregates.available',
            symbol='ч',
            balance-label='к коммиту по компонентам',
            icon='schedule',
            :loading='timeStatsLoading'
          )
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='В ожидании',
            :balance='timeAggregates.pending',
            symbol='ч',
            balance-label='ожидают выполнения задачи',
            icon='hourglass_empty',
            :loading='timeStatsLoading'
          )
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='Подтверждено',
            :balance='timeAggregates.committed',
            symbol='ч',
            balance-label='зафиксировано в учёте',
            icon='verified',
            :loading='timeStatsLoading'
          )

      TimeStatsWidget(
        :coopname='info.coopname',
        :username='username',
        :expanded='expandedProjects',
        @toggle-expand='handleProjectToggleExpand',
        @project-click='handleProjectToggleExpand',
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
            @issue-click='handleIssueToggleExpand',
            @data-loaded='handleIssuesDataLoaded'
          )
            template(#issue-content='{ issue }')
              TimeEntriesWidget(
                :issue-hash='issue.issue_hash',
                :coopname='info.coopname',
                :username='username'
              )

    //- Мои коммиты: свои (на проверке / приняты / отклонены)
    template(v-else-if='activeTab === "mine"')
      CommitsListWidget(
        :key='"mine-" + username',
        :filter='mineFilter',
        :expanded='expanded',
        empty-title='Своих коммитов пока нет',
        empty-body='Зафиксируйте время по выполненным кооперативным задачам — коммиты появятся здесь.',
        @toggle-expand='handleCommitToggleExpand',
        @data-loaded='handleCommitsDataLoaded',
        @pagination-changed='handlePaginationChanged'
      )

    //- На проверке: чужие коммиты по проектам мастера / все для совета
    template(v-else-if='activeTab === "review" && canReview')
      .row.q-col-gutter-md
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='Ожидают',
            :balance='reviewAggregates.pendingCount',
            symbol='шт',
            balance-label='коммитов на проверке',
            icon='hourglass_empty'
          )
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='Часов к проверке',
            :balance='reviewAggregates.pendingHours',
            symbol='ч',
            balance-label='по ожидающим коммитам',
            icon='schedule'
          )
        .col-12.col-md-4
          WalletCard(
            neutral,
            title='Сумма к проверке',
            :balance='reviewAggregates.pendingSum',
            :symbol='governSymbol',
            balance-label='себестоимость ожидающих',
            icon='payments'
          )

      CommitsListWidget(
        :key='"review-" + username',
        :filter='reviewFilter',
        :expanded='expanded',
        empty-title='Нет коммитов на проверке',
        empty-body='Когда участники отправят время по вашим компонентам, коммиты появятся здесь.',
        @toggle-expand='handleCommitToggleExpand',
        @data-loaded='handleCommitsDataLoaded',
        @pagination-changed='handlePaginationChanged'
      )
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useExpandableState, useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { PageTabs } from 'src/shared/ui/layout';
import type { PageTab } from 'src/shared/ui/layout/PageTabs';
import { CommitsListWidget, TimeStatsWidget, TimeIssuesWidget, TimeEntriesWidget } from 'app/extensions/capital/widgets';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';
import { useTimeStatsStore } from 'app/extensions/capital/entities/TimeStats/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const COMMITS_EXPANDED_KEY = 'capital_commits_expanded';
const PROJECTS_EXPANDED_KEY = 'capital_commits_time_projects_expanded';
const ISSUES_EXPANDED_KEY = 'capital_commits_time_issues_expanded';

const activeTab = ref<'time' | 'mine' | 'review'>('time');
const timeStatsLoading = ref(true);
const canReview = ref(false);

const currentPage = ref(1);
const currentRowsPerPage = ref(100);
const currentSortBy = ref('created_at');
const currentDescending = ref(true);

const { info } = useSystemStore();
const session = useSessionStore();
const commitStore = useCommitStore();
const timeStatsStore = useTimeStatsStore();
const { commits } = storeToRefs(commitStore);
const { timeStats } = storeToRefs(timeStatsStore);

const username = computed(() => session.username || '');
const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    { key: 'time', label: 'Моё время' },
    { key: 'mine', label: 'Мои коммиты' },
  ];
  if (canReview.value) {
    list.push({ key: 'review', label: 'На проверке' });
  }
  return list;
});

const mineFilter = computed(() => ({
  coopname: info.coopname,
  username: username.value,
}));

const reviewFilter = computed(() => ({
  coopname: info.coopname,
  status: Zeus.CommitStatus.CREATED,
}));

const {
  expanded,
  loadExpandedState: loadCommitsExpandedState,
  cleanupExpandedByKeys: cleanupCommitsExpanded,
  toggleExpanded: toggleCommitExpanded,
} = useExpandableState(COMMITS_EXPANDED_KEY);

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

function formatHoursMetric(hours: number): string {
  const n = hours || 0;
  return n % 1 === 0 ? String(n) : String(parseFloat(n.toFixed(1)));
}

function parseAssetAmount(value?: string): number {
  if (!value) return 0;
  const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

const timeAggregates = computed(() => {
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
    available: formatHoursMetric(available),
    pending: formatHoursMetric(pending),
    committed: formatHoursMetric(committed),
  };
});

const reviewAggregates = computed(() => {
  const items = commits.value?.items ?? [];
  let pendingCount = 0;
  let pendingHours = 0;
  let pendingSum = 0;

  for (const row of items) {
    if (row.status !== Zeus.CommitStatus.CREATED) continue;
    pendingCount += 1;
    pendingHours += Number(row.amounts?.creators_hours) || 0;
    pendingSum += parseAssetAmount(row.amounts?.creators_base_pool ?? undefined);
  }

  const sumAsset = `${pendingSum.toFixed(4)} ${governSymbol.value}`;

  return {
    pendingCount: String(pendingCount),
    pendingHours: formatHoursMetric(pendingHours),
    pendingSum: formatAsset2Digits(sumAsset).replace(/\s+[A-Z]+$/, '').trim() || '0,00',
  };
});

function onSelectTab(tab: PageTab) {
  if (tab.key === 'time' || tab.key === 'mine' || tab.key === 'review') {
    activeTab.value = tab.key;
  }
}

const handleCommitToggleExpand = (commitHash: string) => {
  toggleCommitExpanded(commitHash);
};

const handleProjectToggleExpand = (projectHash: string) => {
  toggleProjectExpanded(projectHash);
};

const handleIssueToggleExpand = (issueHash: string) => {
  toggleIssueExpanded(issueHash);
};

const handleProjectsDataLoaded = (projectHashes: string[]) => {
  cleanupProjectsExpanded(projectHashes);
  timeStatsLoading.value = false;
};

const handleIssuesDataLoaded = (issueHashes: string[]) => {
  cleanupIssuesExpanded(issueHashes);
};

const handleCommitsDataLoaded = (commitHashes: string[]) => {
  cleanupCommitsExpanded(commitHashes);
};

const handlePaginationChanged = (paginationData: {
  page: number;
  rowsPerPage: number;
  sortBy: string;
  descending: boolean;
}) => {
  currentPage.value = paginationData.page;
  currentRowsPerPage.value = paginationData.rowsPerPage;
  currentSortBy.value = paginationData.sortBy;
  currentDescending.value = paginationData.descending;
};

async function resolveCanReview(): Promise<void> {
  const role = session.providerAccount?.role;
  if (role === 'chairman' || role === 'member') {
    canReview.value = true;
    return;
  }
  if (!username.value) {
    canReview.value = false;
    return;
  }
  try {
    const res = await ProjectApi.loadProjects({
      filter: {
        coopname: info.coopname,
        master: username.value,
        origin: 'blockchain',
      },
      options: { page: 1, limit: 1, sortOrder: 'ASC' },
    });
    canReview.value = (res.totalCount ?? res.items?.length ?? 0) > 0;
  } catch {
    canReview.value = false;
  }
}

const reloadCommitsData = async () => {
  if (!username.value) return;
  if (activeTab.value === 'time') return;
  try {
    const filter =
      activeTab.value === 'review'
        ? { coopname: info.coopname, status: Zeus.CommitStatus.CREATED }
        : { coopname: info.coopname, username: username.value };

    await commitStore.loadCommits({
      filter: filter as never,
      options: {
        page: currentPage.value,
        limit: currentRowsPerPage.value,
        sortBy: currentSortBy.value,
        sortOrder: currentDescending.value ? 'DESC' : 'ASC',
      },
    });
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных коммитов в poll:', error);
  }
};

const { start: startCommitsPoll, stop: stopCommitsPoll } = useDataPoller(
  reloadCommitsData,
  { interval: POLL_INTERVALS.MEDIUM, immediate: false },
);

watch(activeTab, (tab) => {
  if (tab === 'review' && !canReview.value) {
    activeTab.value = 'mine';
  }
});

onMounted(async () => {
  loadCommitsExpandedState();
  loadProjectsExpandedState();
  loadIssuesExpandedState();
  await resolveCanReview();
  startCommitsPoll();
});

onBeforeUnmount(() => {
  stopCommitsPoll();
});
</script>

<style lang="scss" scoped>
.page-surface {
  background: var(--p-surface);
  overflow: auto;
}

.commits-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
}

@media (max-width: 768px) {
  .commits-page__body {
    padding: var(--p-4);
  }
}
</style>
