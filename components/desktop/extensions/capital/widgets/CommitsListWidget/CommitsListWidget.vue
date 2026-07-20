<template lang="pug">
q-card(flat)

  q-table(
    :rows='commits?.items || []',
    :columns='columns',
    row-key='commit_hash',
    :pagination='pagination',
    @request='onRequest',
    flat,
    square,
    :no-data-label='"Нет коммитов"'
  )
    template(#body='props')
      q-tr(
        :props='props',
        @click.prevent.stop='handleCommitClick(props.row.commit_hash)',
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[props.row.commit_hash]',
            @click='handleToggleExpand(props.row.commit_hash)'
          )
        // Проекты и компоненты с возможностью перехода
        q-td(style='max-width: 250px; word-wrap: break-word; white-space: normal')
          .projects-info
            .project-link(
              v-if='props.row.project?.parent_title',
              @click.stop='navigateToProject(props.row.project.parent_hash)'
            )
              q-icon(name='fa-regular fa-folder', size='xs').q-mr-xs
              span.list-item-title {{ props.row.project.parent_title }}
            .component-link(
              v-if='props.row.project?.title',
              @click.stop='navigateToComponent(props.row.project_hash)'
            )
              q-icon(name='fa-regular fa-folder-open', size='xs').q-mr-xs
              span.list-item-title {{ props.row.project.title }}

        // Пользователь
        q-td(style='width: 120px')
          .text-grey-7 {{ props.row.display_name || props.row.username || 'Неизвестный' }}

        // Статус
        q-td(style='width: 120px')
          q-chip(
            :color='getStatusColor(props.row.status)',
            :text-color="'white'",
            dense,
            size='sm'
          ) {{ getStatusLabel(props.row.status) }}

        // Затраченное время
        q-td.text-right(style='width: 100px')
          .stats-info
            ColorCard(color='blue')
              .card-value {{ formatHours(Number(props.row.amounts?.creators_hours) || 0) }}

        // Стоимость часа
        q-td.text-right(style='width: 120px')
          .stats-info
            ColorCard(color='orange')
              .card-value {{ formatCurrency(props.row.amounts?.hour_cost) }} / час

        // Сумма
        q-td.text-right(style='width: 150px')
          .stats-info
            ColorCard(color='green')

              .card-value {{ formatCurrency(props.row.amounts?.creators_base_pool) }}

        // Кнопки действий
        q-td(style='width: 120px')
          .row.items-center.q-gutter-xs.justify-end(v-if='props.row.project?.master === session.username')
            ApproveCommitButton(
              v-if='props.row.status === Zeus.CommitStatus.CREATED'
              :commit-hash='props.row.commit_hash'
              mini
            )

            DeclineCommitButton(
              v-if='props.row.status === Zeus.CommitStatus.CREATED'
              :commit-hash='props.row.commit_hash'
              mini
            )
      // Разворачиваемый контент с деталями коммита
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[props.row.commit_hash]',
        :key='`e_${props.row.commit_hash}`'
      )

        q-td(colspan='9', style='padding: 16px;')
          .commit-details
            .row.q-gutter-md
              .col
                .text-subtitle2.text-grey-7 Дата:
                .text-body2 {{ formatDate(props.row.created_at) }}

            .q-mt-md
              .q-mt-md(v-if='getContributionFeedback(props.row.data)')
                .text-subtitle2.text-grey-7.q-mt-md Отзыв и оценка работы
                q-rating(
                  :model-value='getContributionFeedback(props.row.data)?.satisfaction_stars ?? 1',
                  readonly,
                  size='sm',
                  color='accent'
                )
                pre.commit-message-code(v-if='getContributionFeedback(props.row.data)?.review_text')
                  | {{ getContributionFeedback(props.row.data)?.review_text }}

              .q-mt-md(v-if='props.row.description')
                .text-subtitle2.text-grey-7 Сообщение коммита (блокчейн):
                pre.commit-message-code {{ props.row.description }}

              .q-mt-md(v-if='getGitData(props.row.data)?.url')
                .text-subtitle2.text-grey-7 Ссылка:
                a(:href='getGitData(props.row.data).url', target='_blank', rel='noopener noreferrer').commit-url {{ getGitData(props.row.data).url }}

              .q-mt-md(v-if='getGitData(props.row.data)?.diff')
                .text-subtitle2.text-grey-7 Изменения:
                DiffViewer(:diff='getGitData(props.row.data).diff')

</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { QTableProps } from 'quasar';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';
import type { IGetCommitsFilter } from 'app/extensions/capital/entities/Commit/model';
import { ApproveCommitButton } from 'app/extensions/capital/features/Commit/ApproveCommit';
import { DeclineCommitButton } from 'app/extensions/capital/features/Commit/DeclineCommit';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { Zeus } from '@coopenomics/sdk';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatHours } from 'src/shared/lib/utils';
import { DiffViewer } from 'src/shared/ui/DiffViewer';


const props = defineProps<{
  filter?: IGetCommitsFilter;
  expanded?: Record<string, boolean>;
}>();

const emit = defineEmits<{
  toggleExpand: [commitHash: string];
  commitClick: [commitHash: string];
  dataLoaded: [commitHashes: string[]];
  paginationChanged: [pagination: { page: number; rowsPerPage: number; sortBy: string; descending: boolean }];
}>();

const router = useRouter();
const session = useSessionStore();
const { info } = useSystemStore();
const commitStore = useCommitStore();

const commits = ref<any>(null);
const loading = ref(false);

// Используем computed для реактивной связи с props.expanded
const expanded = computed({
  get: () => props.expanded || {},
  set: () => {
    // Сеттер не используется напрямую, изменения происходят через emit
  }
});

// Следим за изменениями в commitStore и обновляем локальные данные
watch(() => commitStore.commits, (newCommits) => {
  if (newCommits) {
    commits.value = newCommits;
    pagination.value.rowsNumber = newCommits.totalCount || 0;

    // Эмитим событие загрузки данных
    const commitHashes = newCommits.items?.map(item => item.commit_hash) || [];
    emit('dataLoaded', commitHashes);
  }
}, { deep: true });

// Пагинация
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 100,
  rowsNumber: 0,
});

// Загрузка коммитов
const loadCommits = async (paginationData?: any) => {
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

    // Эмитим событие загрузки данных с актуальными ключами коммитов
    const commitHashes = commitStore.commits?.items?.map(
      (commit: any) => commit.commit_hash,
    ) || [];

    emit('dataLoaded', commitHashes);
  } catch (error) {
    console.error('Ошибка при загрузке коммитов:', error);
    FailAlert('Не удалось загрузить список коммитов');
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
  pagination.value.descending = descending;

  // Эмитим изменение пагинации для родительской страницы
  emit('paginationChanged', {
    page,
    rowsPerPage,
    sortBy,
    descending,
  });

  await loadCommits(pagination.value);
};

const handleToggleExpand = (commitHash: string) => {
  emit('toggleExpand', commitHash);
};

const handleCommitClick = (commitHash: string) => {
  emit('commitClick', commitHash);
};

// Вспомогательные функции
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};


// Функции для работы со статусами
const getStatusColor = (status: string) => {
  switch (status) {
    case Zeus.CommitStatus.CREATED:
      return 'orange';
    case Zeus.CommitStatus.APPROVED:
      return 'green';
    case Zeus.CommitStatus.DECLINED:
      return 'red';
    case Zeus.CommitStatus.UNDEFINED:
      return 'grey';
    default:
      return 'grey';
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

// Функция форматирования валюты
const formatCurrency = (value?: string) => {
  if (!value) return '0.00';
  return formatAsset2Digits(value);
};

// Функция для извлечения Git-данных из массива данных коммита
const getGitData = (data: any[] | null | undefined) => {
  if (!data || !Array.isArray(data)) return undefined;
  const gitItem = data.find(item => item?.type === 'git');
  return gitItem?.data;
};

interface IContributionFeedbackView {
  satisfaction_stars: number;
  review_text: string;
}

const getContributionFeedback = (data: unknown[] | null | undefined): IContributionFeedbackView | undefined => {
  if (!data || !Array.isArray(data)) return undefined;
  const row = data.find(
    (item): item is { type: 'contribution_feedback'; data: { review_text?: unknown; satisfaction_stars?: unknown } } =>
      !!item &&
      typeof item === 'object' &&
      (item as { type?: string }).type === 'contribution_feedback',
  );
  if (!row?.data || typeof row.data !== 'object') return undefined;
  const stars = Number((row.data as { satisfaction_stars?: unknown }).satisfaction_stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return undefined;
  const reviewText =
    typeof (row.data as { review_text?: unknown }).review_text === 'string'
      ? (row.data as { review_text: string }).review_text
      : '';
  return { satisfaction_stars: stars, review_text: reviewText };
};

// Функция навигации к проекту (родительскому)
const navigateToProject = (projectHash: string) => {
  if (projectHash) {
    router.push({
      name: 'project-description',
      params: { project_hash: projectHash },
      query: { _useHistoryBack: 'true' }
    });
  }
};

// Функция навигации к компоненту
const navigateToComponent = (projectHash: string) => {
  if (projectHash) {
    router.push({
      name: 'component-description',
      params: { project_hash: projectHash },
      query: { _useHistoryBack: 'true' }
    });
  }
};

// Загружаем данные при монтировании
onMounted(async () => {
  await loadCommits();
});

// Определяем столбцы таблицы
const columns: QTableProps['columns'] = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'projects',
    label: 'Проект / Компонент',
    align: 'left' as const,
    field: 'project.title' as const,
    sortable: false,
  },
  {
    name: 'user',
    label: 'Пользователь',
    align: 'left' as const,
    field: 'username' as const,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Статус',
    align: 'center' as const,
    field: 'status' as const,
    sortable: true,
  },
  {
    name: 'hours',
    label: 'Время',
    align: 'right' as const,
    field: 'amounts.creators_hours' as const,
    sortable: true,
  },
  {
    name: 'hour_rate',
    label: 'Стоимость часа',
    align: 'right' as const,
    field: 'amounts.hour_cost' as const,
    sortable: true,
  },
  {
    name: 'total',
    label: 'Сумма',
    align: 'right' as const,
    field: 'amounts.total_contribution' as const,
    sortable: true,
  },
  {
    name: 'actions',
    label: 'Действия',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
];
</script>

<style lang="scss" scoped>
.projects-info {
  .project-link {
    display: block;
    cursor: pointer;
    margin-bottom: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .project-title {
      font-size: 0.875rem;
      font-weight: 500;
      word-wrap: break-word;
      white-space: normal;
      line-height: 1.3;
    }
  }

  .component-link {
    display: block;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    margin-left: 16px;
    border-left: 2px solid #1976d2;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(25, 118, 210, 0.08);
    }

    .component-title {
      font-size: 0.875rem;
      word-wrap: break-word;
      white-space: normal;
      line-height: 1.3;
    }
  }
}

.stats-info {
  display: flex;
  justify-content: center;
  align-items: center;
}

.commit-details {
  .text-subtitle2 {
    margin-bottom: 4px;
  }

  .text-body2 {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }
  .commit-text {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    word-break: break-all;
    flex: 1;

    a {
      color: var(--q-primary);
      text-decoration: underline;

      &:hover {
        text-decoration: none;
      }
    }
  }

  .commit-url {
    color: var(--q-primary);
    text-decoration: underline;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;

    &:hover {
      text-decoration: none;
    }
  }

  .commit-message-code {

    padding: 10px 12px;
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 0.8125rem;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 6px;
    max-height: 280px;
    overflow: auto;
  }
}

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}
</style>
