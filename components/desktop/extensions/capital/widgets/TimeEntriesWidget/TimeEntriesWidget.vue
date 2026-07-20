<template lang="pug">
q-card(flat, style='margin-left: 20px; margin-top: 8px;')
  q-table(
    :rows='timeEntries?.items || []',
    :columns='columns',
    row-key='_id',
    :loading='loading',
    flat,
    square,
    hide-header,
    hide-bottom,
    :pagination='pagination',
    @request='onRequest'
  )

    template(#body='props')
      q-tr(:props='props')
        q-td
          .commit-info(v-if='props.row.commit_hash')
            q-chip(
              color='blue',
              text-color='white',
              dense,
              size='sm',
              :label='`Commit: ${props.row.commit_hash.substring(0, 8)}`'
            )
        q-td.text-right
          .stats-info
            .stat-item
              ColorCard(color='grey')
                .card-value {{ formatHours(props.row.hours) }}
                .card-label {{ formatDate(props.row.date) }}
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { useTimeEntriesStore } from 'app/extensions/capital/entities/TimeEntries/model';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatHours } from 'src/shared/lib/utils';

const props = defineProps<{
  issueHash: string;
  coopname?: string;
  username?: string;
}>();

const { info } = useSystemStore();
const timeEntriesStore = useTimeEntriesStore();

const timeEntries = ref<any>(null);
const loading = ref(false);

// Определяем столбцы таблицы
const columns = [
  {
    name: 'commit',
    label: 'Коммит',
    align: 'left' as const,
    field: 'commit_hash' as const,
    sortable: false,
  },
  {
    name: 'ticket',
    label: 'Билет времени',
    align: 'right' as const,
    field: 'hours' as const,
    sortable: true,
  },
];

// Пагинация
const pagination = ref({
  sortBy: '_created_at',
  sortOrder: 'DESC',
  page: 1,
  rowsPerPage: 100,
  rowsNumber: 0,
});


// Форматирование даты
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU');
};

// Загрузка данных по записям времени
const loadTimeEntries = async (paginationData?: any) => {
  if (!props.issueHash) return;

  const paginationToUse = paginationData || pagination.value;
  loading.value = true;

  try {
    const entries = await timeEntriesStore.loadTimeEntries({
      filter: {
        coopname: props.coopname || info.coopname,
        issue_hash: props.issueHash,
        username: props.username,
      },
      options: {
        page: paginationToUse.page,
        limit: paginationToUse.rowsPerPage,
        sortBy: paginationToUse.sortBy,
        sortOrder: paginationToUse.sortOrder,
      },
    });

    timeEntries.value = entries;
    pagination.value.rowsNumber = entries.totalCount;
  } catch (error) {
    console.error('Ошибка при загрузке записей времени:', error);
    FailAlert('Не удалось загрузить записи времени');
  } finally {
    loading.value = false;
  }
};

// Обработчик запросов пагинации и сортировки
const onRequest = async (requestProps: any) => {
  const { page, rowsPerPage, sortBy, descending } = requestProps.pagination;

  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.sortOrder = descending ? 'DESC' : 'ASC';

  await loadTimeEntries(pagination.value);
};

// Загружаем данные при монтировании и изменении issueHash
onMounted(() => {
  loadTimeEntries();
});

watch(() => props.issueHash, () => {
  // Сбрасываем пагинацию при изменении issue
  pagination.value.page = 1;
  loadTimeEntries();
});
</script>

<style lang="scss" scoped>

.commit-info {
  max-width: 200px;
}

.label {
  font-weight: 400;
  color: #666;
  margin-right: 4px;
}

.stats-info {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .stat-label {
    font-size: 0.75rem;
    color: #666;
    white-space: nowrap;
  }

  :deep(.color-card) {
    margin-bottom: 0;
    padding: 6px 8px 2px 8px;
  }
}

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
