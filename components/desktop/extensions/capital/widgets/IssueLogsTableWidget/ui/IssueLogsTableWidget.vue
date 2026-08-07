<template lang="pug">
.issue-logs(:class='{ "issue-logs--compact": compact }')
  .issue-logs__loading(v-if='initialLoading')
    q-skeleton(v-for='n in 4', :key='n', type='text', height='40px', class='q-mb-sm')

  template(v-else)
    ActivityTimeline(
      v-if='events.length',
      :events='events',
      group-by-date
    )

    .issue-logs__more(v-if='loading && logs.length')
      q-spinner(color='primary', size='20px')

    q-intersection(
      v-if='hasMorePages && !loading && logs.length',
      @visibility='loadNextPage',
      once
    )

    EmptyState(
      v-if='!logs.length && !loading',
      title='История пуста',
      body='Здесь появятся изменения задачи, коммиты и связанные действия.'
    )
      template(#icon)
        q-icon(name='history', size='40px')
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';
import { ActivityTimeline } from 'src/shared/ui/domain/ActivityTimeline';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { FailAlert } from 'src/shared/api';
import { mapCapitalLogToActivity } from 'app/extensions/capital/shared/lib/mapCapitalLogToActivity';

interface Props {
  issueHash: string;
  refreshTrigger?: number;
  /** Узкий сайдбар */
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const issueStore = useIssueStore();

const logs = ref<any[]>([]);
const loading = ref(false);
const initialLoading = ref(false);
const currentPage = ref(1);
const hasMorePages = ref(true);
const pageSize = 20;

const events = computed(() => logs.value.map(mapCapitalLogToActivity));

async function loadLogs(page = 1, append = false) {
  if (append) loading.value = true;
  else initialLoading.value = true;

  try {
    const result = await issueStore.loadIssueLogs({
      data: {
        issue_hash: props.issueHash,
      },
      options: {
        page,
        limit: pageSize,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      },
    });

    logs.value = append ? [...logs.value, ...result.items] : result.items;
    hasMorePages.value = result.items.length === pageSize;
  } catch (error) {
    console.error('Ошибка при загрузке логов задачи:', error);
    FailAlert('Не удалось загрузить историю задачи');
  } finally {
    loading.value = false;
    initialLoading.value = false;
  }
}

function loadNextPage() {
  if (!loading.value && hasMorePages.value) {
    currentPage.value++;
    void loadLogs(currentPage.value, true);
  }
}

watch(
  () => props.issueHash,
  async (newHash, oldHash) => {
    if (newHash && newHash !== oldHash) {
      currentPage.value = 1;
      hasMorePages.value = true;
      await loadLogs(1, false);
    }
  },
);

watch(
  () => props.refreshTrigger,
  async (newValue, oldValue) => {
    if (newValue !== oldValue && newValue !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      currentPage.value = 1;
      hasMorePages.value = true;
      await loadLogs(1, false);
    }
  },
);

onMounted(async () => {
  await loadLogs(1, false);
});
</script>

<style lang="scss" scoped>
.issue-logs {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.issue-logs--compact {
  gap: var(--p-3);

  :deep(.activity-timeline__group-head) {
    font-size: var(--p-fs-meta);
  }

  :deep(.activity-timeline__title) {
    font-size: var(--p-fs-body-sm);
  }
}

.issue-logs__loading,
.issue-logs__more {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.issue-logs__more {
  align-items: center;
  padding: var(--p-3);
}
</style>
