<template lang="pug">
.time-issues
  .time-issues__empty.t-sm.t-muted(v-if='!loading && !rows.length')
    | Нет задач с учётом времени в этом компоненте

  .time-issues__list(v-else)
    .time-issues__item(v-for='row in rows', :key='row.issue_hash')
      .time-issues__row(
        role='button',
        tabindex='0',
        @click='handleIssueClick(row.issue_hash)',
        @keydown.enter.prevent='handleIssueClick(row.issue_hash)',
        @keydown.space.prevent='handleIssueClick(row.issue_hash)'
      )
        ExpandToggleButton(
          :expanded='expanded[row.issue_hash]',
          @click='handleToggleExpand(row.issue_hash)'
        )
        q-icon.time-issues__icon(name='task_alt', size='18px')
        .time-issues__main
          .time-issues__title(@click.stop='goToIssue(row)') {{ row.issue_title }}
          .time-issues__sub.t-sm.t-muted(v-if='showName') {{ row.contributor_name }}
        .time-issues__meta.t-sm
          span.time-issues__metric(v-if='row.available_hours') {{ formatHours(row.available_hours) }} доступно
          span.time-issues__metric.time-issues__metric--warn(v-if='row.pending_hours') {{ formatHours(row.pending_hours) }} ожидание
          span.time-issues__metric.time-issues__metric--info(v-if='row.committed_hours') {{ formatHours(row.committed_hours) }} подтверждено
          span.time-issues__metric.t-muted(v-if='!row.available_hours && !row.pending_hours && !row.committed_hours') 0 ч

      .time-issues__children(v-if='expanded[row.issue_hash]')
        slot(name='issue-content', :issue='row')

  .row.justify-center.q-py-sm(v-if='loading')
    q-spinner(color='primary', size='24px')
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { useTimeIssuesStore } from 'app/extensions/capital/entities/TimeIssues/model';
import type { ITimeIssuesPagination } from 'app/extensions/capital/entities/TimeIssues/model/types'
import { formatHours } from 'src/shared/lib/utils';

const props = defineProps<{
  projectHash: string;
  coopname?: string;
  username?: string;
  expanded: Record<string, boolean>;
  showName?: boolean;
}>();

const emit = defineEmits<{
  toggleExpand: [issueHash: string];
  issueClick: [issueHash: string];
  dataLoaded: [issueHashes: string[]];
}>();

const router = useRouter();
const { info } = useSystemStore();
const timeIssuesStore = useTimeIssuesStore();

// Тип из SDK, а не Record<string, any>: иначе строка не совпадает с
// сигнатурой goToIssue и проверка типов её не пропускает.
const timeIssues = ref<ITimeIssuesPagination | null>(null);
const loading = ref(false);

const rows = computed(() => timeIssues.value?.items ?? []);

const loadTimeIssues = async () => {
  if (!props.projectHash) return;

  loading.value = true;
  try {
    const issues = await timeIssuesStore.loadTimeIssues({
      filter: {
        coopname: props.coopname || info.coopname,
        project_hash: props.projectHash,
        username: props.username,
      },
      options: {
        page: 1,
        limit: 50,
        sortBy: 'total_hours',
        sortOrder: 'DESC',
      },
    });

    timeIssues.value = issues;

    const issueHashes = issues.items.map((issue) => issue.issue_hash);
    emit('dataLoaded', issueHashes);
  } catch (error) {
    console.error('Ошибка при загрузке задач проекта:', error);
    FailAlert('Не удалось загрузить задачи проекта');
  } finally {
    loading.value = false;
  }
};

const handleToggleExpand = (issueHash: string) => {
  emit('toggleExpand', issueHash);
};

const handleIssueClick = (issueHash: string) => {
  emit('issueClick', issueHash);
};

const goToIssue = (row: { project_hash: string; issue_hash: string }) => {
  router.push({
    name: 'component-issue',
    params: {
      project_hash: row.project_hash,
      issue_hash: row.issue_hash,
    },
  });
};

onMounted(() => {
  loadTimeIssues();
});

watch(
  () => props.projectHash,
  () => {
    loadTimeIssues();
  },
);

// После createCommit store перезагружает задачи проекта — подтягиваем в локальный список без ухода со страницы
watch(
  () => [timeIssuesStore.timeIssues, timeIssuesStore.lastLoadedProjectHash] as const,
  ([next, loadedProjectHash]) => {
    if (!next || loadedProjectHash !== props.projectHash) return;
    timeIssues.value = next;
    const issueHashes = next.items?.map((issue) => issue.issue_hash) || [];
    emit('dataLoaded', issueHashes);
  },
);
</script>

<style lang="scss" scoped>
.time-issues {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.time-issues__empty {
  padding: var(--p-3) 0;
}

.time-issues__list {
  display: flex;
  flex-direction: column;
}

.time-issues__item + .time-issues__item {
  border-top: 1px solid var(--p-line);
}

.time-issues__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  padding: var(--p-2) 0;
  cursor: pointer;
  min-width: 0;
}

.time-issues__row:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

.time-issues__icon {
  color: var(--p-ink-2);
  flex-shrink: 0;
  margin-top: 2px;
}

.time-issues__main {
  flex: 1 1 10rem;
  min-width: 0;
}

.time-issues__title {
  font-weight: 500;
  color: var(--p-ink);
  word-break: break-word;
}

.time-issues__title:hover {
  color: var(--p-primary);
}

.time-issues__sub {
  margin-top: var(--p-1);
}

.time-issues__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
  justify-content: flex-end;
  margin-left: auto;
  flex: 0 1 auto;
  max-width: 100%;
  color: var(--p-ink-2);
  text-align: right;
}

.time-issues__metric--warn {
  color: var(--p-warn);
}

.time-issues__metric--info {
  color: var(--p-info);
}

.time-issues__children {
  padding: 0 0 var(--p-2) var(--p-5);
  min-width: 0;
}
</style>
