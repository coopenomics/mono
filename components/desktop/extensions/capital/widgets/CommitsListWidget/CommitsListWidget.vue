<template lang="pug">
.commits-list
  EmptyState(
    v-if='!loading && !rows.length',
    :title='emptyTitle',
    :body='emptyBody'
  )
    template(#icon)
      q-icon(name='fact_check')

  .row.justify-center.q-py-lg(v-else-if='loading && !rows.length')
    q-spinner(color='primary', size='32px')

  template(v-else)
    .commits-list__items
      .commits-list__item(v-for='row in rows', :key='row.commit_hash')
        //- Строка как у «Время»: иконка + заголовок/мета слева, статус+действие справа
        .commits-list__row(
          role='button',
          tabindex='0',
          @click='handleToggleExpand(row.commit_hash)',
          @keydown.enter.prevent='handleToggleExpand(row.commit_hash)',
          @keydown.space.prevent='handleToggleExpand(row.commit_hash)'
        )
          ExpandToggleButton(
            :expanded='!!expanded[row.commit_hash]',
            @click='handleToggleExpand(row.commit_hash)'
          )
          q-icon.commits-list__icon(name='folder_open', size='20px')

          .commits-list__main
            .commits-list__title(
              @click.stop='navigateToComponent(row.project_hash)'
            ) {{ row.project?.title || 'Компонент' }}
            .commits-list__sub.t-sm.t-muted
              span.commits-list__parent(
                v-if='row.project?.parent_title',
                @click.stop='navigateToProject(row.project.parent_hash)'
              ) {{ row.project.parent_title }}
              span(v-if='row.project?.parent_title') ·
              span {{ row.display_name || row.username || 'Неизвестный' }}
            .commits-list__hours.t-sm
              BaseBadge(:variant='getStatusVariant(row.status)') {{ getStatusLabel(row.status) }}
              BaseBadge(variant='info') {{ formatHours(Number(row.amounts?.creators_hours) || 0) }}
              BaseBadge(variant='neutral') {{ formatCurrency(row.amounts?.creators_base_pool) }}

          .commits-list__actions(
            v-if='canModerate(row)',
            @click.stop
          )
            ApproveCommitButton(:commit-hash='row.commit_hash', mini)
            DeclineCommitButton(:commit-hash='row.commit_hash', mini)

        //- Детали — только в развороте, через DataRow
        .commits-list__details(v-if='expanded[row.commit_hash]')
          DataRow(label='Дата', :value='formatDate(row.created_at)')
          DataRow(
            label='Стоимость часа',
            :value='`${formatCurrency(row.amounts?.hour_cost)} / час`'
          )
          DataRow(
            label='Себестоимость',
            :value='formatCurrency(row.amounts?.creators_base_pool)'
          )

          .commits-list__feedback(v-if='getCommittedIssues(row.data).length')
            .t-sm.t-muted Задачи
            ul.commits-list__issues
              li(v-for='issue in getCommittedIssues(row.data)', :key='issue.issue_hash')
                a.commits-list__issue-link(
                  href='#',
                  @click.prevent.stop='goToIssue(row.project_hash, issue.issue_hash)'
                ) {{ issue.title }}

          .commits-list__feedback(v-if='getContributionFeedback(row.data)')
            .t-sm.t-muted Отзыв и оценка работы
            q-rating(
              v-if='(getContributionFeedback(row.data)?.satisfaction_stars ?? 0) >= 1',
              :model-value='getContributionFeedback(row.data)?.satisfaction_stars ?? 1',
              readonly,
              size='sm',
              color='accent'
            )
            pre.commits-list__pre(v-if='getContributionFeedback(row.data)?.review_text')
              | {{ getContributionFeedback(row.data)?.review_text }}

          .commits-list__feedback(v-if='row.description')
            .t-sm.t-muted Сообщение коммита
            pre.commits-list__pre {{ row.description }}

          .commits-list__feedback(v-if='getGitData(row.data)?.url')
            .t-sm.t-muted Ссылка
            a.commits-list__url(
              :href='getGitData(row.data)?.url',
              target='_blank',
              rel='noopener noreferrer'
            ) {{ getGitData(row.data)?.url }}

          .commits-list__feedback(v-if='getGitData(row.data)?.diff')
            .t-sm.t-muted Изменения
            DiffViewer(:diff="getGitData(row.data)?.diff ?? ''")

    .commits-list__foot.t-sm.t-muted(v-if='pagination.rowsNumber > pagination.rowsPerPage')
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
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';
import type { IGetCommitsFilter } from 'app/extensions/capital/entities/Commit/model';
import { ApproveCommitButton } from 'app/extensions/capital/features/Commit/ApproveCommit';
import { DeclineCommitButton } from 'app/extensions/capital/features/Commit/DeclineCommit';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge, BaseButton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatHours } from 'src/shared/lib/utils';
import { DiffViewer } from 'src/shared/ui/DiffViewer';

const props = withDefaults(
  defineProps<{
    filter?: IGetCommitsFilter;
    expanded?: Record<string, boolean>;
    emptyTitle?: string;
    emptyBody?: string;
  }>(),
  {
    emptyTitle: 'Коммитов пока нет',
    emptyBody:
      'Когда участники зафиксируют время по компонентам, коммиты появятся здесь для проверки.',
  },
);

const emit = defineEmits<{
  toggleExpand: [commitHash: string];
  dataLoaded: [commitHashes: string[]];
  paginationChanged: [pagination: {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
  }];
}>();

const router = useRouter();
const session = useSessionStore();
const { info } = useSystemStore();
const commitStore = useCommitStore();

const commits = ref<{ items?: Array<Record<string, any>>; totalCount?: number } | null>(null);
const loading = ref(false);

const expanded = computed(() => props.expanded || {});
const rows = computed(() => commits.value?.items ?? []);

const pagination = ref({
  sortBy: 'created_at',
  descending: true,
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
  () => commitStore.commits,
  (newCommits) => {
    if (newCommits) {
      commits.value = newCommits;
      pagination.value.rowsNumber = newCommits.totalCount || 0;
      emit(
        'dataLoaded',
        newCommits.items?.map((item) => item.commit_hash) || [],
      );
    }
  },
  { deep: true },
);

const loadCommits = async (paginationData?: typeof pagination.value) => {
  const paginationToUse = paginationData || pagination.value;
  loading.value = true;

  try {
    const filter: IGetCommitsFilter = {
      coopname: info.coopname,
      ...props.filter,
    };

    await commitStore.loadCommits({
      filter,
      options: {
        page: paginationToUse.page,
        limit: paginationToUse.rowsPerPage,
        sortBy: paginationToUse.sortBy,
        sortOrder: paginationToUse.descending ? 'DESC' : 'ASC',
      },
    });

    commits.value = commitStore.commits;
    pagination.value.rowsNumber = commitStore.commits?.totalCount || 0;
    emit(
      'dataLoaded',
      commitStore.commits?.items?.map((commit) => commit.commit_hash) || [],
    );
  } catch (error) {
    console.error('Ошибка при загрузке коммитов:', error);
    FailAlert('Не удалось загрузить список коммитов');
  } finally {
    loading.value = false;
  }
};

const goToPage = async (page: number) => {
  pagination.value.page = page;
  emit('paginationChanged', {
    page: pagination.value.page,
    rowsPerPage: pagination.value.rowsPerPage,
    sortBy: pagination.value.sortBy,
    descending: pagination.value.descending,
  });
  await loadCommits(pagination.value);
};

const handleToggleExpand = (commitHash: string) => {
  emit('toggleExpand', commitHash);
};

const canModerate = (row: Record<string, any>) =>
  row.project?.master === session.username &&
  row.status === Zeus.CommitStatus.CREATED;

const formatDate = (dateString: string) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusVariant = (status: string): BaseBadgeVariant => {
  switch (status) {
    case Zeus.CommitStatus.CREATED:
      return 'warn';
    case Zeus.CommitStatus.APPROVED:
      return 'pos';
    case Zeus.CommitStatus.DECLINED:
      return 'neg';
    default:
      return 'neutral';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case Zeus.CommitStatus.CREATED:
      return 'Ожидает';
    case Zeus.CommitStatus.APPROVED:
      return 'Одобрен';
    case Zeus.CommitStatus.DECLINED:
      return 'Отклонен';
    case Zeus.CommitStatus.UNDEFINED:
      return 'Не определен';
    default:
      return status;
  }
};

const formatCurrency = (value?: string) => {
  if (!value) return '0,00';
  return formatAsset2Digits(value);
};

const getGitData = (data: unknown[] | null | undefined) => {
  if (!data || !Array.isArray(data)) return undefined;
  const gitItem = data.find(
    (item) => !!item && typeof item === 'object' && (item as { type?: string }).type === 'git',
  ) as { data?: { url?: string; diff?: string } } | undefined;
  return gitItem?.data;
};

interface IContributionFeedbackView {
  satisfaction_stars: number;
  review_text: string;
}

const getContributionFeedback = (
  data: unknown[] | null | undefined,
): IContributionFeedbackView | undefined => {
  if (!data || !Array.isArray(data)) return undefined;
  const row = data.find(
    (item): item is {
      type: 'contribution_feedback';
      data: { review_text?: unknown; satisfaction_stars?: unknown };
    } =>
      !!item &&
      typeof item === 'object' &&
      (item as { type?: string }).type === 'contribution_feedback',
  );
  if (!row?.data || typeof row.data !== 'object') return undefined;
  const starsRaw = Number(row.data.satisfaction_stars);
  const hasStars = Number.isInteger(starsRaw) && starsRaw >= 1 && starsRaw <= 5;
  const reviewText = typeof row.data.review_text === 'string' ? row.data.review_text.trim() : '';
  if (!hasStars && !reviewText) return undefined;
  return {
    satisfaction_stars: hasStars ? starsRaw : 0,
    review_text: reviewText,
  };
};

const getCommittedIssues = (
  data: unknown[] | null | undefined,
): Array<{ issue_hash: string; title: string }> => {
  if (!data || !Array.isArray(data)) return [];
  const row = data.find(
    (item) => !!item && typeof item === 'object' && (item as { type?: string }).type === 'committed_issues',
  ) as { data?: { issues?: Array<{ issue_hash?: string; title?: string }> } } | undefined;
  const issues = row?.data?.issues;
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((issue) => !!issue?.issue_hash)
    .map((issue) => ({
      issue_hash: String(issue.issue_hash),
      title: String(issue.title || issue.issue_hash).trim(),
    }));
};

const navigateToProject = (projectHash?: string) => {
  if (!projectHash) return;
  router.push({
    name: 'project-description',
    params: { project_hash: projectHash },
    query: { _useHistoryBack: 'true' },
  });
};

const navigateToComponent = (projectHash?: string) => {
  if (!projectHash) return;
  router.push({
    name: 'component-description',
    params: { project_hash: projectHash },
    query: { _useHistoryBack: 'true' },
  });
};

const goToIssue = (projectHash: string | undefined, issueHash: string) => {
  if (!projectHash || !issueHash) return;
  router.push({
    name: 'component-issue',
    params: {
      project_hash: projectHash,
      issue_hash: issueHash,
    },
    query: { _useHistoryBack: 'true' },
  });
};

onMounted(async () => {
  await loadCommits();
});

watch(
  () => props.filter,
  () => {
    pagination.value.page = 1;
    void loadCommits();
  },
  { deep: true },
);
</script>

<style lang="scss" scoped>
.commits-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.commits-list__items {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--p-line);
}

.commits-list__item {
  border-bottom: 1px solid var(--p-line);
}

.commits-list__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  padding: var(--p-3) 0;
  cursor: pointer;
  min-width: 0;
}

.commits-list__row:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

.commits-list__icon {
  color: var(--p-ink-2);
  flex-shrink: 0;
  margin-top: 2px;
}

.commits-list__main {
  flex: 1 1 12rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.commits-list__title {
  font-weight: 500;
  color: var(--p-ink);
  word-break: break-word;
}

.commits-list__title:hover {
  color: var(--p-primary);
}

.commits-list__sub {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1);
  align-items: baseline;
}

.commits-list__parent:hover {
  color: var(--p-primary);
  cursor: pointer;
}

.commits-list__hours {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
}

.commits-list__actions {
  flex: 0 0 auto;
  margin-left: auto;
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
}

.commits-list__details {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: 0 0 var(--p-4) var(--p-6);
  min-width: 0;
}

.commits-list__feedback {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.commits-list__issues {
  margin: 0;
  padding-left: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.commits-list__issue-link {
  color: var(--p-primary);
  word-break: break-word;
}

.commits-list__pre {
  margin: 0;
  padding: var(--p-3);
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm);
  border: 1px solid var(--p-line);
  max-height: 280px;
  overflow: auto;
}

.commits-list__url {
  color: var(--p-primary);
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  word-break: break-all;
}

.commits-list__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
