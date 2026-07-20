<template lang="pug">
q-card(flat, style='margin-left: 20px; margin-top: 8px;')
  q-table(
    :rows='timeIssues?.items || []',
    :columns='columns',
    row-key='issue_hash',
    :loading='loading',
    flat,
    square,
    hide-header,
    hide-bottom,
    no-data-label='Нет данных по задачам'
  )
    template(#body='props')
      q-tr(
        :props='props',
        @click='handleIssueClick(props.row.issue_hash)'
        style='cursor: pointer'
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[props.row.issue_hash]',
            @click='handleToggleExpand(props.row.issue_hash)'
          )

        q-td(
          style='max-width: 200px; word-wrap: break-word; white-space: normal; cursor: pointer'
        )
          .title-container
            q-icon(name='fa-solid fa-check', size='xs').q-mr-sm
            span.list-item-title(
              @click.stop='() => router.push({ name: "component-issue", params: { project_hash: props.row.project_hash, issue_hash: props.row.issue_hash } })'
            ) {{ props.row.issue_title }}
          .subtitle(v-if='showName')
            | {{ props.row.contributor_name }}
        q-td.text-right
          .stats-info
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
                .card-value {{ formatHours(props.row.committed_hours) }}
                .card-label Подтверждено

      // Слот для дополнительного контента задачи (TimeEntriesWidget)
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[props.row.issue_hash]',
        :key='`e_${props.row.issue_hash}`'
      )
        q-td(colspan='100%', style='padding: 0px !important')
          slot(name='issue-content', :issue='props.row')
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { useTimeIssuesStore } from 'app/extensions/capital/entities/TimeIssues/model';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
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

const timeIssues = ref<any>(null);
const loading = ref(false);

// Загрузка данных по задачам проекта
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
        limit: 50, // Загружаем все задачи проекта
        sortBy: 'total_hours',
        sortOrder: 'DESC',
      },
    });

    timeIssues.value = issues;

    // Эмитим событие загрузки данных с актуальными ключами задач
    const issueHashes = issues.items.map(issue => issue.issue_hash);
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

// Загружаем данные при монтировании и изменении projectHash
onMounted(() => {
  loadTimeIssues();
});

watch(() => props.projectHash, () => {
  loadTimeIssues();
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
    label: 'Задача',
    align: 'left' as const,
    field: 'issue_title' as const,
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
  margin-bottom: 2px;

  .label {
    font-weight: 400;
    color: #666;
    margin-right: 4px;
  }
}

.subtitle {
  font-size: 0.75rem;
  color: #888;
  font-weight: 400;
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
