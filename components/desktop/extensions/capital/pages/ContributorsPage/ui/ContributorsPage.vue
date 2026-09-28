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
import { ref, computed, onMounted } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { ContributorsListWidget } from 'app/extensions/capital/widgets/ContributorsListWidget';
import { ImportContributorButton } from 'app/extensions/capital/features/Contributor/ImportContributor';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useHeaderActions } from 'src/shared/hooks';
import { t } from '../../../i18n';

const contributorStore = useContributorStore();
const systemStore = useSystemStore();
const sessionStore = useSessionStore();
const { registerAction } = useHeaderActions();

const loading = ref(false);

const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

// Массовый импорт из CSV (ImportContributorsButton) остаётся скрытым.
//
// Кнопка «Добавить» нужна только председателю «Восхода»: там реестр Благороста
// заполняют руками по прежним договорам. В остальных кооперативах участник
// заводит себя сам через регистрацию.
const canAddContributor = computed(
  () => sessionStore.isChairman && systemStore.info.coopname === 'voskhod',
);

const loadContributors = async () => {
  loading.value = true;
  try {
    await contributorStore.loadContributors({
      filter: {
        coopname: systemStore.info.coopname,
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
    FailAlert(t('capital.contributorsPage.loadError'));
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
        coopname: systemStore.info.coopname,
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

// Живой экран: перечитывается по ленте изменений Благороста вместо опроса по
// таймеру (набор таблиц — shared/lib/live).
useLiveReload(CAPITAL_LIVE_TABLES, reloadContributors);

onMounted(async () => {
  if (canAddContributor.value) {
    registerAction({
      id: 'add-contributor',
      component: ImportContributorButton,
      order: 1,
    });
  }
  await loadContributors();
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
