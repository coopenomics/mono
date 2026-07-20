<template lang="pug">
q-card(flat)

  q-table(
    :rows='timeStats?.items || []',
    :columns='columns',
    row-key='project_hash',
    :loading='loading',
    :pagination='pagination',
    @request='onRequest',
    flat,
    square,
    hide-header
  )

    template(#body='props')
      q-tr(
        :props='props',
        @click='handleProjectClick(props.row.project_hash)'
        style='cursor: pointer'
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[props.row.project_hash]',
            @click='handleToggleExpand(props.row.project_hash)'
          )
        q-td(
          style='max-width: 200px; word-wrap: break-word; white-space: normal; cursor: pointer'
        )
          .title-container
            q-icon(name='fa-regular fa-folder', size='xs').q-mr-sm
            span.list-item-title(
              @click.stop='() => router.push({ name: "component-description", params: { project_hash: props.row.project_hash }, query: { _useHistoryBack: "true" } })'
            ) {{ props.row.project_name }}
        q-td.text-right
          .stats-info
            .commit-button
            q-icon(
              v-if='props.row.available_hours <= 0',
              name='help_outline',
              size='sm',
              color='grey'
            )
              q-tooltip Билеты времени станут доступными для коммита после перевода задачи в статус выполненной

            q-icon(
              v-else-if='!canOpenCommitDialog(props.row.available_hours)',
              name='help_outline',
              size='sm',
              color='grey'
            )
              q-tooltip Накоплено меньше одного полного часа по завершённым задачам. Дробная часть сохраняется в учёте до следующего накопления.

            CreateCommitButton(
              :project-hash='props.row.project_hash',
              :project-title='props.row.project_name',
              :disabled='!canOpenCommitDialog(props.row.available_hours)',
              :uncommitted-hours='props.row.available_hours'
            )
            .stat-item
              ColorCard(color='green')
                .card-value {{ formatHours(props.row.available_hours) }}
                .card-label Доступно
            .stat-item
              ColorCard(color='orange')
                .card-value {{ formatHours(props.row.pending_hours) }}
                .card-label В ожидании
            .stat-item
              ColorCard(color='blue')
                .card-value {{ formatHours(props.row.total_committed_hours) }}
                .card-label Подтверждено
      // Слот для дополнительного контента проекта (TimeEntriesWidget)
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[props.row.project_hash]',
        :key='`e_${props.row.project_hash}`'
      )
        q-td(colspan='100%', style='padding: 0px !important')
          slot(name='project-content', :project='props.row')

    template(#no-data)
      .text-center.text-grey-6.q-pa-md
        | У вас нет статистики времени по проектам
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';

const HOURS_EPS = 1e-9;

/** Полных часов, которые можно отправить в блокчейн при текущем накоплении */
function fullHoursForChain(available: number): number {
  return Math.floor((available || 0) + HOURS_EPS);
}

function canOpenCommitDialog(available: number): boolean {
  return fullHoursForChain(available) >= 1;
}
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useTimeStatsStore } from 'app/extensions/capital/entities/TimeStats/model';
import type { ITimeStatsPagination } from 'app/extensions/capital/entities/TimeStats/model/types';
import { useSystemStore } from 'src/entities/System/model';
import { CreateCommitButton } from 'app/extensions/capital/features/Commit/CreateCommit/ui';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatHours } from 'src/shared/lib/utils';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';

const props = defineProps<{
  coopname?: string;
  username?: string;
  expanded: Record<string, boolean>;
}>();

const router = useRouter();
const { info } = useSystemStore();
const emit = defineEmits<{
  toggleExpand: [projectHash: string];
  projectClick: [projectHash: string];
  dataLoaded: [projectHashes: string[]];
  paginationChanged: [pagination: { page: number; rowsPerPage: number; sortBy: string; sortOrder: string }];
}>();

const timeStatsStore = useTimeStatsStore();

const timeStats = ref<ITimeStatsPagination | null>(null);
const loading = ref(false);

// Следим за изменениями в timeStatsStore и обновляем локальные данные
watch(() => timeStatsStore.timeStats, (newTimeStats) => {
  if (newTimeStats) {
    timeStats.value = newTimeStats;
    pagination.value.rowsNumber = newTimeStats.totalCount || 0;

    // Эмитим событие загрузки данных
    const projectHashes = newTimeStats.items?.map(item => item.project_hash) || [];
    emit('dataLoaded', projectHashes);
  }
}, { deep: true });

// Пагинация
const pagination = ref({
  sortBy: 'project_name',
  sortOrder: 'ASC',
  page: 1,
  rowsPerPage: 100,
  rowsNumber: 0,
});

// Загрузка данных по статистике проектов
const loadTimeStats = async (paginationData?: any) => {
  const paginationToUse = paginationData || pagination.value;
  loading.value = true;

  try {
    const stats = await timeStatsStore.loadTimeStats({
      data: {
        username: props.username,
        coopname: props.coopname || info.coopname,
      },
      options: {
        page: paginationToUse.page,
        limit: paginationToUse.rowsPerPage,
        sortBy: paginationToUse.sortBy,
        sortOrder: paginationToUse.sortOrder,
      },
    });
    console.log('status: ', stats)
    timeStats.value = stats;
    pagination.value.rowsNumber = stats.totalCount;

    // Эмитим событие загрузки данных с актуальными ключами проектов
    const projectHashes = stats.items.map(project => project.project_hash);
    emit('dataLoaded', projectHashes);
  } catch (error) {
    console.error('Ошибка при загрузке статистики времени:', error);
    FailAlert('Не удалось загрузить статистику времени');
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

  // Эмитим изменение пагинации для родительской страницы
  emit('paginationChanged', {
    page,
    rowsPerPage,
    sortBy,
    sortOrder: descending ? 'DESC' : 'ASC',
  });

  await loadTimeStats(pagination.value);
};

const handleToggleExpand = (projectHash: string) => {
  emit('toggleExpand', projectHash);
};

const handleProjectClick = (projectHash: string) => {
  emit('projectClick', projectHash);
};

// Загружаем данные при монтировании
onMounted(async () => {
  await loadTimeStats();
});

// Определяем столбцы таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'name',
    label: 'Проект',
    align: 'left' as const,
    field: 'project_name' as const,
    sortable: true,
  },
  {
    name: 'stats',
    label: 'Статистика',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
];
</script>

<style lang="scss" scoped>
.title-container {
  font-weight: 500;
  font-size: 1.05rem;

  .label {
    font-weight: 400;
    color: #666;
    margin-right: 4px;
  }
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

  &.total {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid #eee;
  }

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


.commit-button {
  display: flex;
  justify-content: flex-start;
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
