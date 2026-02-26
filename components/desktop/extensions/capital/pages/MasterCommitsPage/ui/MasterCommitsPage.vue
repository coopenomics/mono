<template lang="pug">
div
  WindowLoader(v-show='isInitialLoading', text='Загрузка коммитов...')
  q-card(v-show='!isInitialLoading', flat)
    div

      // Виджет списка коммитов
      CommitsListWidget(
        :expanded='expanded',
        :force-reload='forceReload',
        @toggle-expand='handleCommitToggleExpand',
        @commit-click='handleCommitClick',
        @data-loaded='handleCommitsDataLoaded'
        @pagination-changed='handlePaginationChanged'
      )
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useExpandableState } from 'src/shared/lib/composables';
import { useGraphqlSubscription, buildSubscriptionQuery } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { CommitsListWidget } from 'app/extensions/capital/widgets';
import { useSystemStore } from 'src/entities/System/model';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';

// Ключи для сохранения состояния в LocalStorage
const COMMITS_EXPANDED_KEY = 'capital_commits_expanded';

// Состояние первичной загрузки (WindowLoader)
const isInitialLoading = ref(true);

// Состояние для принудительной перезагрузки данных
const forceReload = ref(0);

// Текущее состояние пагинации для poll обновлений
const currentPage = ref(1);
const currentRowsPerPage = ref(100);
const currentSortBy = ref('created_at');
const currentDescending = ref(true);

// Инициализация store'ов
const { info } = useSystemStore();
const commitStore = useCommitStore();

// Управление развернутостью коммитов
const {
  expanded,
  loadExpandedState: loadCommitsExpandedState,
  cleanupExpandedByKeys: cleanupCommitsExpanded,
  toggleExpanded: toggleCommitExpanded,
} = useExpandableState(COMMITS_EXPANDED_KEY);

// Состояние для подсчета общего количества элементов
const totalCommitsCount = ref(0);

const handleCommitClick = () => {
  // Клик на строку коммита - переход к деталям или другое действие
  // Разворот осуществляется только через кнопку toggle
};

const handleCommitToggleExpand = (commitHash: string) => {
  toggleCommitExpanded(commitHash);
};

const handleCommitsDataLoaded = (commitHashes: string[]) => {
  // Очищаем устаревшие записи expanded коммитов после загрузки данных
  cleanupCommitsExpanded(commitHashes);

  // Сохраняем количество коммитов для indeterminate логики
  totalCommitsCount.value = commitHashes.length;

  // Отключаем WindowLoader после завершения первичной загрузки
  isInitialLoading.value = false;
};

const handlePaginationChanged = (paginationData: { page: number; rowsPerPage: number; sortBy: string; descending: boolean }) => {
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
    console.warn('Ошибка при перезагрузке коммитов:', error);
  }
};

useGraphqlSubscription({
  query: buildSubscriptionQuery('capitalCommitCreated', null, ['id', 'commit_hash', 'status']),
  onData: () => { forceReload.value++; reloadCommitsData(); },
});

useGraphqlSubscription({
  query: buildSubscriptionQuery('capitalCommitUpdated', null, ['id', 'commit_hash', 'status']),
  onData: () => { forceReload.value++; reloadCommitsData(); },
});

onMounted(async () => {
  loadCommitsExpandedState();
});
</script>

<style lang="scss" scoped>
// Стили если необходимо
</style>
