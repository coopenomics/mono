<template lang="pug">
//- Коммиты: как «Время» — surface + WalletCard-агрегаты + чистый аккордеон.
.commits-page
  WindowLoader(v-show='isInitialLoading', text='Загрузка коммитов...')
  .commits-page__body(v-show='!isInitialLoading')
    .row.q-col-gutter-md
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='Ожидают',
          :balance='aggregates.pendingCount',
          symbol='шт',
          balance-label='коммитов на проверке',
          icon='hourglass_empty',
          :loading='isInitialLoading'
        )
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='Часов к проверке',
          :balance='aggregates.pendingHours',
          symbol='ч',
          balance-label='по ожидающим коммитам',
          icon='schedule',
          :loading='isInitialLoading'
        )
      .col-12.col-md-4
        WalletCard(
          neutral,
          title='Сумма к проверке',
          :balance='aggregates.pendingSum',
          :symbol='governSymbol',
          balance-label='себестоимость ожидающих',
          icon='payments',
          :loading='isInitialLoading'
        )

    CommitsListWidget(
      :expanded='expanded',
      @toggle-expand='handleCommitToggleExpand',
      @data-loaded='handleCommitsDataLoaded',
      @pagination-changed='handlePaginationChanged'
    )
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useExpandableState, useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { WindowLoader } from 'src/shared/ui/Loader';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { CommitsListWidget } from 'app/extensions/capital/widgets';
import { useSystemStore } from 'src/entities/System/model';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const COMMITS_EXPANDED_KEY = 'capital_commits_expanded';

const isInitialLoading = ref(true);

const currentPage = ref(1);
const currentRowsPerPage = ref(100);
const currentSortBy = ref('created_at');
const currentDescending = ref(true);

const { info } = useSystemStore();
const commitStore = useCommitStore();
const { commits } = storeToRefs(commitStore);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const {
  expanded,
  loadExpandedState: loadCommitsExpandedState,
  cleanupExpandedByKeys: cleanupCommitsExpanded,
  toggleExpanded: toggleCommitExpanded,
} = useExpandableState(COMMITS_EXPANDED_KEY);

function formatHoursMetric(hours: number): string {
  const n = hours || 0;
  return n % 1 === 0 ? String(n) : String(parseFloat(n.toFixed(1)));
}

function parseAssetAmount(value?: string): number {
  if (!value) return 0;
  const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

const aggregates = computed(() => {
  const items = commits.value?.items ?? [];
  let pendingCount = 0;
  let pendingHours = 0;
  let pendingSum = 0;

  for (const row of items) {
    if (row.status !== Zeus.CommitStatus.CREATED) continue;
    pendingCount += 1;
    pendingHours += Number(row.amounts?.creators_hours) || 0;
    pendingSum += parseAssetAmount(row.amounts?.creators_base_pool);
  }

  const sumAsset = `${pendingSum.toFixed(4)} ${governSymbol.value}`;

  return {
    pendingCount: String(pendingCount),
    pendingHours: formatHoursMetric(pendingHours),
    pendingSum: formatAsset2Digits(sumAsset).replace(/\s+[A-Z]+$/, '').trim() || '0,00',
  };
});

const handleCommitToggleExpand = (commitHash: string) => {
  toggleCommitExpanded(commitHash);
};

const handleCommitsDataLoaded = (commitHashes: string[]) => {
  cleanupCommitsExpanded(commitHashes);
  isInitialLoading.value = false;
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

const reloadCommitsData = async () => {
  try {
    await commitStore.loadCommits({
      filter: { coopname: info.coopname },
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

onMounted(() => {
  loadCommitsExpandedState();
  startCommitsPoll();
});

onBeforeUnmount(() => {
  stopCommitsPoll();
});
</script>

<style lang="scss" scoped>
.commits-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
}

.commits-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  flex: 1;
  min-height: 0;
}

@media (max-width: 768px) {
  .commits-page {
    padding: var(--p-4);
  }
}
</style>
