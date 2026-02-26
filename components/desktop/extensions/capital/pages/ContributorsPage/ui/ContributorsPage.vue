<template lang="pug">
div
  q-card(flat)
    // Таблица участников
    ContributorsListWidget(
      :contributors='contributorStore.contributors?.items || []',
      :loading='loading',
      :pagination='pagination',
      @request='onRequest'
    )
    // Пагинация
    q-card-actions(align='center')
      q-pagination(
        v-model='pagination.page',
        :max='Math.ceil((contributorStore.contributors?.totalCount || 0) / pagination.rowsPerPage)',
        :max-pages='5',
        direction-links,
        boundary-links,
        @update:model-value='onPageChange'
      )
</template>

<script lang="ts" setup>
import { ref, onMounted, markRaw, computed, onBeforeUnmount } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { ContributorsListWidget } from 'app/extensions/capital/widgets/ContributorsListWidget';
import { ImportContributorsButton } from 'app/extensions/capital/widgets/ImportContributorsButton';
import { ImportContributorButton } from 'app/extensions/capital/features/Contributor/ImportContributor';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useGraphqlSubscription, buildSubscriptionQuery } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';

const contributorStore = useContributorStore();
const { info } = useSystemStore();
const sessionStore = useSessionStore();

const loading = ref(false);

// Пагинация
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

// Массив кнопок меню для шапки (только для председателя)
const menuButtons = computed(() => {
  if (!sessionStore.isChairman) {
    return [];
  }

  return [
  {
      id: 'import-contributor-menu',
      component: markRaw(ImportContributorButton),
      order: 1,
    },
    {
      id: 'import-contributors-menu',
      component: markRaw(ImportContributorsButton),
      order: 2,
    },

  ];
});

// Загрузка участников
const loadContributors = async () => {
  loading.value = true;
  try {
    await contributorStore.loadContributors({
      filter: {
        coopname: info.coopname,
      },
      pagination: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        descending: pagination.value.descending,
      },
    });
  } catch (error) {
    console.error('Ошибка при загрузке участников:', error);
    FailAlert('Не удалось загрузить список участников');
  } finally {
    loading.value = false;
  }
};

// Обработчик запросов пагинации и сортировки
const onRequest = async (props: { pagination: any }) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;

  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.descending = descending;

  await loadContributors();
};

// Обработчик изменения страницы пагинации
const onPageChange = async (page: number) => {
  pagination.value.page = page;
  await loadContributors();
};

useGraphqlSubscription({
  query: buildSubscriptionQuery('capitalDataChanged', null, ['entity', 'action']),
  onData: () => { loadContributors(); },
});

const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

onMounted(async () => {
  await loadContributors();

  menuButtons.value.forEach(button => {
    registerHeaderAction(button);
  });
});

onBeforeUnmount(() => {
  clearActions();
});
</script>

<style lang="scss" scoped>
.q-card {
  min-height: 400px;
}

h5 {
  font-weight: 600;
  color: #1976d2;
}
</style>
