<template lang="pug">
.time-stats
  EmptyState(
    v-if='!loading && !rows.length',
    title='Нет статистики времени',
    body='Когда вы учтёте часы по задачам компонентов, они появятся здесь.'
  )
    template(#icon)
      q-icon(name='schedule')

  .row.justify-center.q-py-lg(v-else-if='loading && !rows.length')
    q-spinner(color='primary', size='32px')

  template(v-else)
    .time-stats__list
      .time-stats__item(v-for='row in rows', :key='row.project_hash')
        .time-stats__row(
          role='button',
          tabindex='0',
          @click='handleProjectClick(row.project_hash)',
          @keydown.enter.prevent='handleProjectClick(row.project_hash)',
          @keydown.space.prevent='handleProjectClick(row.project_hash)'
        )
          ExpandToggleButton(
            :expanded='expanded[row.project_hash]',
            @click='handleToggleExpand(row.project_hash)'
          )
          q-icon.time-stats__icon(name='folder', size='20px')
          .time-stats__main
            .time-stats__title(
              @click.stop='goToComponent(row.project_hash)'
            ) {{ row.project_name }}
            .time-stats__hours.t-sm
              BaseBadge(variant='pos') {{ shortHours(row.available_hours) }} доступно
              BaseBadge(variant='warn') {{ shortHours(row.pending_hours) }} ожидание
              BaseBadge(variant='info') {{ shortHours(row.total_committed_hours) }} подтверждено
          .time-stats__actions(v-if='canOpenCommitDialog(row.available_hours)', @click.stop)
            CreateCommitButton(
              :project-hash='row.project_hash',
              :project-title='row.project_name',
              :uncommitted-hours='row.available_hours'
            )

        .time-stats__children(v-if='expanded[row.project_hash]')
          slot(name='project-content', :project='row')

    .time-stats__foot.t-sm.t-muted(v-if='pagination.rowsNumber > pagination.rowsPerPage')
      span {{ rangeLabel }}
      BaseButton(
        variant='ghost',
        size='sm',
        :disabled='pagination.page <= 1',
        @click='goToPage(pagination.page - 1)'
      ) Назад
      BaseButton(
        variant='ghost',
        size='sm',
        :disabled='pagination.page * pagination.rowsPerPage >= pagination.rowsNumber',
        @click='goToPage(pagination.page + 1)'
      ) Ещё
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useTimeStatsStore } from 'app/extensions/capital/entities/TimeStats/model';
import type { ITimeStatsPagination } from 'app/extensions/capital/entities/TimeStats/model/types';
import { useSystemStore } from 'src/entities/System/model';
import { CreateCommitButton } from 'app/extensions/capital/features/Commit/CreateCommit/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge, BaseButton } from 'src/shared/ui/base';

const HOURS_EPS = 1e-9;

function fullHoursForChain(available: number): number {
  return Math.floor((available || 0) + HOURS_EPS);
}

function canOpenCommitDialog(available: number): boolean {
  return fullHoursForChain(available) >= 1;
}

function shortHours(hours: number): string {
  const n = hours || 0;
  const formatted = n % 1 === 0 ? String(n) : String(parseFloat(n.toFixed(1)));
  return `${formatted} ч`;
}

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
}>();

const timeStatsStore = useTimeStatsStore();

const timeStats = ref<ITimeStatsPagination | null>(null);
const loading = ref(false);

const rows = computed(() => timeStats.value?.items ?? []);

const pagination = ref<{
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  page: number;
  rowsPerPage: number;
  rowsNumber: number;
}>({
  sortBy: 'project_name',
  sortOrder: 'ASC',
  page: 1,
  rowsPerPage: 100,
  rowsNumber: 0,
});

const rangeLabel = computed(() => {
  const { page, rowsPerPage, rowsNumber } = pagination.value;
  if (!rowsNumber) return '';
  const from = (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, rowsNumber);
  return `${from}-${to} из ${rowsNumber}`;
});

watch(
  () => timeStatsStore.timeStats,
  (newTimeStats) => {
    if (newTimeStats) {
      timeStats.value = newTimeStats;
      pagination.value.rowsNumber = newTimeStats.totalCount || 0;
      const projectHashes = newTimeStats.items?.map((item) => item.project_hash) || [];
      emit('dataLoaded', projectHashes);
    }
  },
  { deep: true },
);

const loadTimeStats = async (paginationData?: typeof pagination.value) => {
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
    timeStats.value = stats;
    pagination.value.rowsNumber = stats.totalCount;

    const projectHashes = stats.items.map((project) => project.project_hash);
    emit('dataLoaded', projectHashes);
  } catch (error) {
    console.error('Ошибка при загрузке статистики времени:', error);
    FailAlert('Не удалось загрузить статистику времени');
  } finally {
    loading.value = false;
  }
};

const goToPage = async (page: number) => {
  pagination.value.page = page;
  await loadTimeStats(pagination.value);
};

const handleToggleExpand = (projectHash: string) => {
  emit('toggleExpand', projectHash);
};

const handleProjectClick = (projectHash: string) => {
  emit('projectClick', projectHash);
};

const goToComponent = (projectHash: string) => {
  router.push({
    name: 'component-description',
    params: { project_hash: projectHash },
  });
};

onMounted(async () => {
  await loadTimeStats();
});
</script>

<style lang="scss" scoped>
.time-stats {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.time-stats__list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--p-line);
}

.time-stats__item {
  border-bottom: 1px solid var(--p-line);
}

.time-stats__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  padding: var(--p-3) 0;
  cursor: pointer;
  min-width: 0;
}

.time-stats__row:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

.time-stats__icon {
  color: var(--p-ink-2);
  flex-shrink: 0;
  margin-top: 2px;
}

.time-stats__main {
  flex: 1 1 12rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.time-stats__title {
  font-weight: 500;
  color: var(--p-ink);
  word-break: break-word;
}

.time-stats__title:hover {
  color: var(--p-primary);
}

.time-stats__hours {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
}

.time-stats__actions {
  flex: 0 0 auto;
  margin-left: auto;
  align-self: center;
}

.time-stats__children {
  padding: 0 0 var(--p-3) var(--p-6);
  min-width: 0;
}

.time-stats__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
