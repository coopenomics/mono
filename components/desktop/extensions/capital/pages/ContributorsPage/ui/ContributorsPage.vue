<template lang="pug">
.contributors-page
  ContributorsListWidget(
    :contributors='contributorStore.contributors?.items || []',
    :loading='loading',
    :pagination='pagination',
    :total-count='contributorStore.contributors?.totalCount || 0',
    @request='onRequest'
  )
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { ContributorsListWidget } from 'app/extensions/capital/widgets/ContributorsListWidget';
// Кнопки «Добавить» / «Импорт из CSV» временно скрыты — методы могут понадобиться позже
// import { ImportContributorsButton } from 'app/extensions/capital/widgets/ImportContributorsButton';
// import { ImportContributorButton } from 'app/extensions/capital/features/Contributor/ImportContributor';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
// import { useHeaderActions } from 'src/shared/hooks';
// import { useSessionStore } from 'src/entities/Session';
// import { markRaw, computed } from 'vue';

const contributorStore = useContributorStore();
const { info } = useSystemStore();
// const sessionStore = useSessionStore();

const loading = ref(false);

const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

// Временно скрыто: регистрация кнопок «Добавить» / «Импорт из CSV» в шапке
// const menuButtons = computed(() => {
//   if (!sessionStore.isChairman) {
//     return [];
//   }
//   return [
//     {
//       id: 'import-contributor-menu',
//       component: markRaw(ImportContributorButton),
//       order: 1,
//     },
//     {
//       id: 'import-contributors-menu',
//       component: markRaw(ImportContributorsButton),
//       order: 2,
//     },
//   ];
// });
// const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

const loadContributors = async () => {
  loading.value = true;
  try {
    await contributorStore.loadContributors({
      filter: {
        coopname: info.coopname,
      },
      options: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        sortOrder: pagination.value.descending ? 'DESC' : 'ASC',
      },
    });
    pagination.value.rowsNumber = contributorStore.contributors?.totalCount || 0;
  } catch (error) {
    console.error('Ошибка при загрузке участников:', error);
    FailAlert('Не удалось загрузить список участников');
  } finally {
    loading.value = false;
  }
};

const onRequest = async (props: {
  pagination: {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
  };
}) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;
  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.descending = descending;
  await loadContributors();
};

const reloadContributors = async () => {
  try {
    await contributorStore.loadContributors({
      filter: {
        coopname: info.coopname,
      },
      options: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        sortOrder: pagination.value.descending ? 'DESC' : 'ASC',
      },
    });
    pagination.value.rowsNumber = contributorStore.contributors?.totalCount || 0;
  } catch (error) {
    console.warn('Ошибка при перезагрузке участников в poll:', error);
  }
};

const { start: startContributorsPoll, stop: stopContributorsPoll } = useDataPoller(
  reloadContributors,
  { interval: POLL_INTERVALS.MEDIUM, immediate: false },
);

onMounted(async () => {
  await loadContributors();
  startContributorsPoll();
  // menuButtons.value.forEach((button) => registerHeaderAction(button));
});

onBeforeUnmount(() => {
  stopContributorsPoll();
  // clearActions();
});
</script>

<style lang="scss" scoped>
.contributors-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
  min-width: 0;
  box-sizing: border-box;
}
</style>
