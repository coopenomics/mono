<template lang="pug">
.project-logs
  .project-logs__loading(v-if='initialLoading')
    q-skeleton(v-for='n in 6', :key='n', type='text', height='48px', class='q-mb-sm')

  template(v-else)
    ActivityTimeline(
      v-if='events.length',
      :events='events',
      group-by-date
    )

    .project-logs__more(v-if='loading && logs.length')
      q-spinner(color='primary', size='24px')

    q-intersection(
      v-if='hasMorePages && !loading && logs.length',
      @visibility='loadNextPage',
      once
    )

    EmptyState(
      v-if='!logs.length && !loading',
      title='Записей пока нет',
      body='Здесь появится лента действий по проектам, инвестициям и результатам.'
    )
      template(#icon)
        q-icon(name='history', size='48px')
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { ActivityTimeline } from 'src/shared/ui/domain/ActivityTimeline';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { FailAlert } from 'src/shared/api';
import { mapCapitalLogToActivity } from 'app/extensions/capital/shared/lib/mapCapitalLogToActivity';

interface Props {
  projectHash?: string;
  showComponentsLogs?: boolean;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showComponentsLogs: true,
});

const projectStore = useProjectStore();

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
    const filter: Record<string, unknown> = {
      show_components_logs: props.showComponentsLogs,
    };
    if (props.projectHash) filter.project_hash = props.projectHash;

    const result = await projectStore.loadProjectLogs({
      filter,
      pagination: {
        page,
        limit: pageSize,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      },
    });

    logs.value = append ? [...logs.value, ...result.items] : result.items;
    hasMorePages.value = result.items.length === pageSize;
  } catch (error) {
    console.error('Ошибка при загрузке логов:', error);
    FailAlert(
      props.projectHash
        ? props.showComponentsLogs
          ? 'Не удалось загрузить историю проекта'
          : 'Не удалось загрузить историю компонента'
        : 'Не удалось загрузить ленту активности',
    );
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
  () => props.projectHash,
  async (newHash, oldHash) => {
    if (newHash !== oldHash) {
      currentPage.value = 1;
      hasMorePages.value = true;
      await loadLogs(1, false);
    }
  },
);

watch(
  () => props.showComponentsLogs,
  async () => {
    currentPage.value = 1;
    hasMorePages.value = true;
    await loadLogs(1, false);
  },
);

onMounted(async () => {
  await loadLogs(1, false);
});
</script>

<style lang="scss" scoped>
.project-logs {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h, 64px));
  min-width: 0;
  box-sizing: border-box;
}

.project-logs__loading {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.project-logs__more {
  display: flex;
  justify-content: center;
  padding: var(--p-4);
}
</style>
