<template lang="pug">
//- Список на корне; задача — child через router-view (рейл остаётся на «Мои задачи»)
router-view(v-if='!isRoot')
.my-tasks-page(v-else)
  .page-surface.list-surface.list-surface--fill
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
                :is-private='isPrivateIssue(props.row)',
                @click='openIssue',
                @context-click='openContext'
              )
        template(#no-data)
          .list-empty
            q-icon(name='inbox', size='20px')
            span {{ hasActiveFilters ? 'Нет задач по фильтрам' : 'Нет доступных задач' }}

      .list-empty(v-else-if='!loading')
        q-icon(name='inbox', size='20px')
        span {{ hasActiveFilters ? 'Нет задач по фильтрам' : 'Нет доступных задач' }}

  //- Диалог назначения компонента свободной задаче (открывается по клику «Без компонента»)
  MoveIssueButton(
    v-if='assignIssue',
    ref='assignDialogRef',
    :issue='assignIssue',
    :permissions='assignIssue.permissions',
    hide-trigger,
    @moved='onAssigned'
  )
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model/store';
import { FailAlert } from 'src/shared/api';
import { EMPTY_HASH } from 'src/shared/lib/consts';
import { MoveIssueButton } from 'app/extensions/capital/features/Issue/MoveIssue';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IIssue, IGetIssuesInput } from 'app/extensions/capital/entities/Issue/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import IssueListRow from 'app/extensions/capital/widgets/IssuesListWidget/ui/IssueListRow.vue';
import { FilterDialogWithButton, SortMenuButton } from 'app/extensions/capital/shared/ui';
import { useHeaderActions } from 'src/shared/hooks';
import { useListPreferences } from 'app/extensions/capital/shared/lib';

type IIssuesFilter = NonNullable<IGetIssuesInput['filter']>;

const router = useRouter();
const route = useRoute();
const { info } = useSystemStore();
const session = useSessionStore();
const projectStore = useProjectStore();

const isRoot = computed(() => route.name === 'capital-my-tasks');

// Фильтры и сортировка списка задач — общие с кнопками в шапке
const { filters, sort, hasActiveFilters } = useListPreferences('issues');

const loading = ref(false);
const items = ref<IIssue[]>([]);
const contextByHash = ref<Record<string, string>>({});
const originByHash = ref<Record<string, string>>({});

const assignIssue = ref<IIssue | null>(null);
const assignDialogRef = ref<{ openDialog: () => void } | null>(null);

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
      issues.map((i) => i.project_hash).filter((h): h is string => !!h),
    ),
  ];
  const nextCtx: Record<string, string> = { ...contextByHash.value };
  const nextOrigin: Record<string, string> = { ...originByHash.value };
  await Promise.all(
    hashes.map(async (hash) => {
      if (nextCtx[hash] && nextOrigin[hash]) return;
      let project = projectStore.getProject(hash);
      if (!project) {
        try {
          project = (await projectStore.loadProject({ hash })) as IProject | undefined;
        } catch {
          project = undefined;
        }
      }
      nextCtx[hash] = formatContext(project) || '';
      if (project?.origin) {
        nextOrigin[hash] = project.origin;
      }
    }),
  );
  contextByHash.value = nextCtx;
  originByHash.value = nextOrigin;
}

function contextLabel(issue: IIssue): string {
  if (!issue.project_hash) return 'Без компонента';
  return contextByHash.value[issue.project_hash] || '';
}

function isPrivateIssue(issue: IIssue): boolean {
  if (!issue.project_hash) return true;
  return originByHash.value[issue.project_hash] === 'local';
}

async function reload() {
  if (!isRoot.value) return;
  loading.value = true;
  try {
    // Показываем все доступные задачи; «только мои» — обычный фильтр в шапке.
    // Что именно доступно, решает backend: совет видит всё, пайщик — свою
    // работу и проекты с допуском.
    const filter: IIssuesFilter = {
      coopname: info.coopname,
    };

    if (filters.value.issueStatuses.length) {
      filter.statuses = filters.value.issueStatuses as IIssuesFilter['statuses'];
    }
    if (filters.value.issuePriorities.length) {
      filter.priorities = filters.value.issuePriorities as IIssuesFilter['priorities'];
    }
    if (filters.value.creators.length) {
      filter.creators = filters.value.creators;
    }
    if (filters.value.master) {
      filter.master = filters.value.master;
    }

    const result = await IssueApi.loadIssues({
      filter,
      options: {
        page: 1,
        limit: 100,
        sortBy: sort.value.sortBy,
        sortOrder: sort.value.sortOrder,
      },
    });
    items.value = result?.items ?? [];
    await resolveContexts(items.value);
  } catch (error) {
    console.error(error);
    FailAlert('Не удалось загрузить задачи');
  } finally {
    loading.value = false;
  }
}

function openIssue(issue: IIssue) {
  router.push({
    name: 'my-task-issue-description',
    params: {
      coopname: info.coopname,
      issue_hash: issue.issue_hash,
    },
  });
}

async function openContext(issue: IIssue) {
  if (!issue.project_hash) {
    assignIssue.value = issue;
    await nextTick();
    assignDialogRef.value?.openDialog();
    return;
  }

  let project = projectStore.getProject(issue.project_hash);
  if (!project) {
    try {
      project = (await projectStore.loadProject({ hash: issue.project_hash })) as
        | IProject
        | undefined;
    } catch {
      project = undefined;
    }
  }

  const isLocal = (project?.origin || originByHash.value[issue.project_hash]) === 'local';
  const parent = project?.parent_hash?.trim();
  const hasParent = !!parent && parent !== EMPTY_HASH;

  if (hasParent) {
    router.push({
      name: isLocal ? 'my-component-tasks' : 'component-tasks',
      params: { project_hash: issue.project_hash },
    });
    return;
  }
  router.push({
    name: isLocal ? 'my-project-description' : 'project-description',
    params: { project_hash: issue.project_hash },
  });
}

function onAssigned() {
  assignIssue.value = null;
  void reload();
}

// Кнопки фильтров и сортировки живут в шапке — как на списках проектов и компонентов
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

function registerListHeaderActions(): void {
  registerHeaderAction({
    id: 'capital-issues-filter',
    component: FilterDialogWithButton,
    props: { scope: 'issues' },
    order: 2,
  });
  registerHeaderAction({
    id: 'capital-issues-sort',
    component: SortMenuButton,
    props: { scope: 'issues' },
    order: 3,
  });
}

watch(isRoot, (root) => {
  if (root) {
    registerListHeaderActions();
    void reload();
  } else {
    clearActions();
  }
});

watch(username, () => {
  if (isRoot.value) {
    void reload();
  }
});

// Смена фильтров или сортировки перечитывает список
watch([filters, sort], () => {
  if (isRoot.value) {
    void reload();
  }
}, { deep: true });

onMounted(() => {
  if (isRoot.value) {
    registerListHeaderActions();
    void reload();
  }
});

onBeforeUnmount(() => {
  clearActions();
});
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

.issues-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
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
