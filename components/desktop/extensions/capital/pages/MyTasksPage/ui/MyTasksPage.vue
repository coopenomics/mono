<template lang="pug">
.my-tasks-page
  .page-surface.list-surface.list-surface--fill
    .my-tasks-page__toolbar
      CreateIssueButton(
        label='Создать задачу',
        @action-completed='reload'
      )
    .issues-scroll-area
      q-table(
        v-if='items.length || loading',
        :rows='items',
        :columns='columns',
        row-key='_id',
        :pagination='pagination',
        :loading='loading',
        flat,
        square,
        hide-header,
        hide-pagination,
        :rows-per-page-options='[0]'
      )
        template(#body='props')
          q-tr(:props='props')
            q-td
              IssueListRow(
                :issue='props.row',
                :context-label='contextLabel(props.row)',
                @click='openIssue',
                @context-click='openContext'
              )
        template(#no-data)
          .list-empty
            q-icon(name='inbox', size='20px')
            span Нет задач, где вы исполнитель

      .list-empty(v-else-if='!loading')
        q-icon(name='inbox', size='20px')
        span Нет задач, где вы исполнитель
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model/store';
import { FailAlert } from 'src/shared/api';
import { EMPTY_HASH } from 'src/shared/lib/consts';
import { CreateIssueButton } from 'app/extensions/capital/features/Issue/CreateIssue';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import IssueListRow from 'app/extensions/capital/widgets/IssuesListWidget/ui/IssueListRow.vue';

/** Sentinel в URL для свободных задач без project_hash */
export const FREE_ISSUE_PROJECT_SENTINEL = 'free';

const router = useRouter();
const { info } = useSystemStore();
const session = useSessionStore();
const projectStore = useProjectStore();

const loading = ref(false);
const items = ref<IIssue[]>([]);
const contextByHash = ref<Record<string, string>>({});

const username = computed(() => session.username || '');

const pagination = ref({
  sortBy: '_created_at',
  descending: true,
  page: 1,
  rowsPerPage: 0,
});

const columns = [
  { name: 'title', label: 'Задача', field: 'title', align: 'left' as const },
];

function formatContext(project: IProject | undefined | null): string {
  if (!project) return '';
  const parent = project.parent_hash?.trim();
  const hasParent = !!parent && parent !== EMPTY_HASH;
  if (hasParent && project.parent_title) {
    return `${project.parent_title} — ${project.title}`;
  }
  return project.title || '';
}

async function resolveContexts(issues: IIssue[]) {
  const hashes = [
    ...new Set(
      issues
        .map((i) => i.project_hash)
        .filter((h): h is string => !!h && h !== FREE_ISSUE_PROJECT_SENTINEL),
    ),
  ];
  const next: Record<string, string> = { ...contextByHash.value };
  await Promise.all(
    hashes.map(async (hash) => {
      if (next[hash]) return;
      let project = projectStore.getProject(hash);
      if (!project) {
        try {
          project = (await projectStore.loadProject({ hash })) as IProject | undefined;
        } catch {
          project = undefined;
        }
      }
      next[hash] = formatContext(project) || '';
    }),
  );
  contextByHash.value = next;
}

function contextLabel(issue: IIssue): string {
  if (!issue.project_hash) return 'Без проекта';
  return contextByHash.value[issue.project_hash] || '';
}

async function reload() {
  if (!username.value) return;
  loading.value = true;
  try {
    const result = await IssueApi.loadIssues({
      filter: {
        coopname: info.coopname,
        creators: [username.value],
      },
      options: {
        page: 1,
        limit: 100,
        sortBy: '_created_at',
        sortOrder: 'DESC',
      },
    });
    items.value = result?.items ?? [];
    await resolveContexts(items.value);
  } catch (error) {
    console.error(error);
    FailAlert('Не удалось загрузить мои задачи');
  } finally {
    loading.value = false;
  }
}

function openIssue(issue: IIssue) {
  const projectHash = issue.project_hash || FREE_ISSUE_PROJECT_SENTINEL;
  router.push({
    name: 'component-issue-description',
    params: {
      project_hash: projectHash,
      issue_hash: issue.issue_hash,
    },
    query: { _backRoute: 'capital-my-tasks' },
  });
}

function openContext(issue: IIssue) {
  if (!issue.project_hash) return;
  const project = projectStore.getProject(issue.project_hash);
  const parent = project?.parent_hash?.trim();
  const hasParent = !!parent && parent !== EMPTY_HASH;
  if (hasParent) {
    router.push({
      name: 'component-tasks',
      params: { project_hash: issue.project_hash },
    });
    return;
  }
  router.push({
    name: 'project-description',
    params: { project_hash: issue.project_hash },
  });
}

onMounted(reload);
</script>

<style lang="scss" scoped>
.my-tasks-page {
  height: 100%;
  min-height: 100%;
}

.list-surface {
  background: var(--p-surface);
}

.page-surface {
  background: var(--p-surface);
}

.list-surface--fill {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.my-tasks-page__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: var(--p-3) var(--p-4) 0;
}

.issues-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--p-4) var(--p-4);
}

.q-table {
  table-layout: fixed;
  width: 100%;

  .q-td {
    padding: 0;
    overflow: hidden;
  }
}

.list-empty {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
  padding: var(--p-3) var(--p-4);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
</style>
