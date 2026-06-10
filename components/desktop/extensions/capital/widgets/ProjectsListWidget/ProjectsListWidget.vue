<template lang="pug">
div
  // Скелетон первичной загрузки (poll и догрузка обновляют список молча)
  .projects-skeleton(v-if='isInitialLoading')
    .skel(v-for='i in 8', :key='i')

  .projects-scroll-area(v-else)
    q-table(
      ref='tableRef',
      :rows='projects?.items || []',
      :columns='columns',
      row-key='project_hash',
      :pagination='pagination',
      flat,
      square,
      hide-header,
      hide-pagination,
      virtual-scroll,
      @virtual-scroll='onScroll',
      :virtual-scroll-target='".projects-scroll-area"',
      :virtual-scroll-item-size='48',
      :virtual-scroll-sticky-size-start='48',
      :rows-per-page-options='[0]'
    )
      template(#body='props')
        q-tr(
          :props='props'
        )
          q-td
            .row.items-center.project-row
              // Кнопка раскрытия
              .col-auto.project-row__toggle
                ExpandToggleButton(
                  :expanded='expanded[props.row.project_hash]',
                  @click='handleToggleExpand(props.row.project_hash)'
                )

              // ID с иконкой типа внутри бейджа
              .col-auto.project-row__id
                EntityIdBadge(
                  v-if='props.row.id'
                  :raw-id='props.row.id'
                  copy-on-click
                  address-clipboard
                )
                  template(#prefix)
                    q-icon(name='work', size='xs')

              // Title со статусом
              .col.project-row__title-col
                .list-item-title(
                  @click.stop='handleOpenProject(props.row.project_hash)'
                )
                  q-icon(
                    :name='getProjectStatusIcon(props.row.status)',
                    :color='getProjectStatusDotColor(props.row.status)',
                    size='xs'
                  ).q-mr-sm
                  span {{ props.row.title }}

              // Метрики: часы факт/план и привлечённые инвестиции
              .col-auto.row-meta-block
                .row-meta
                  q-icon(name='schedule', size='14px')
                  span.t-mono-sm {{ formatHoursFactPlan(props.row.fact?.creators_hours, props.row.plan?.creators_hours) }}
                  q-tooltip Часы исполнителей: факт / план
                .row-meta(v-if='hasInvestMeta(props.row.fact?.total_received_investments, props.row.plan?.invest_pool)')
                  q-icon(name='payments', size='14px')
                  span.t-mono-sm {{ formatInvestFactPlan(props.row.fact?.total_received_investments, props.row.plan?.invest_pool) }}
                  q-tooltip Инвестиции: привлечено / план

              // Actions - только CreateComponentButton (выравнивание по правому краю)
              .col-auto.project-row__actions(
                v-if='props.row.permissions?.can_edit_project'
              )
                .row.items-center.justify-end.q-gutter-xs
                  CreateComponentButton(
                    :project='props.row',
                    :mini='true',
                    flat,
                    @click.stop
                  )

        // Слот для дополнительного контента проекта (ComponentsListWidget)
        q-tr.q-virtual-scroll--with-prev(
          no-hover,
          v-if='expanded[props.row.project_hash]',
          :key='`${props.row.project_hash}`'
        )
          q-td.project-row__nested(colspan='100%')
            slot(name='project-content', :project='props.row')

      // Канон-пустое состояние вместо дефолтного q-table no-data
      template(#no-data)
        .list-empty
          q-icon(name='inbox', size='20px')
          span {{ hasFiltersApplied ? 'Нет результатов по фильтрам' : 'Нет проектов' }}
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { EntityIdBadge } from 'src/shared/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { CreateComponentButton } from 'app/extensions/capital/features/Project/CreateComponent';
import { getProjectStatusIcon, getProjectStatusDotColor } from 'app/extensions/capital/shared/lib/projectStatus';
import { formatHoursFactPlan, formatInvestFactPlan, hasInvestMeta } from 'app/extensions/capital/shared/lib';

const props = defineProps<{
  coopname?: string;
  expanded: Record<string, boolean>;

  statuses?: string[];
  priorities?: string[];
  hasIssuesWithStatuses?: string[];
  hasIssuesWithPriorities?: string[];
  master?: string;
}>();

const { info } = useSystemStore();
const emit = defineEmits<{
  toggleExpand: [projectHash: string];
  dataLoaded: [projectHashes: string[], totalComponents?: number];
  openProject: [projectHash: string];
  paginationChanged: [pagination: { page: number; rowsPerPage: number; sortBy: string; descending: boolean }];
}>();

const projectStore = useProjectStore();

const loading = ref(false);
const tableRef = ref(null);
const nextPage = ref(1);
const lastPage = ref(1);

// Используем computed для projects, чтобы всегда получать актуальные данные из store
// Это предотвращает конфликты и "передергивание" списка при разворачивании проектов
const projects = computed(() => projectStore.projects);

// Проверяем, применены ли фильтры
const hasFiltersApplied = computed(() => {
  return (
    (props.statuses?.length ?? 0) > 0 ||
    (props.priorities?.length ?? 0) > 0 ||
    (props.hasIssuesWithStatuses?.length ?? 0) > 0 ||
    (props.hasIssuesWithPriorities?.length ?? 0) > 0 ||
    !!props.master
  );
});

// Проверяем, является ли текущая загрузка начальной (первой)
const isInitialLoading = computed(() => {
  return loading.value && projects.value.items.length === 0;
});

// Пагинация
const pagination = ref({
  sortBy: '_created_at',
  descending: true,
  page: 1,
  rowsPerPage: 0,
  rowsNumber: 0,
});

// Загрузка проектов
const loadProjects = async (page = 1, append = false) => {
  loading.value = true;

  try {
    const filter: any = {
      coopname: props.coopname || info.coopname,
      parent_hash: '',
    };

    // Добавляем дополнительные фильтры, если они переданы
    if (props.statuses?.length) {
      filter.statuses = props.statuses;
    }
    if (props.priorities?.length) {
      filter.priorities = props.priorities;
    }
    if (props.hasIssuesWithStatuses?.length) {
      filter.has_issues_with_statuses = props.hasIssuesWithStatuses;
    }
    if (props.hasIssuesWithPriorities?.length) {
      filter.has_issues_with_priorities = props.hasIssuesWithPriorities;
    }
    if (props.master) {
      filter.master = props.master;
    }

    await projectStore.loadProjects({
      filter,
      options: {
        page,
        limit: 25, // Фиксированный размер страницы для бесконечного скролла
        sortBy: pagination.value.sortBy,
        sortOrder: pagination.value.descending ? 'DESC' : 'ASC',
      },
    }, append);

    // Обновляем состояние пагинации из store
    lastPage.value = projectStore.projects.totalPages || 1;
    pagination.value.rowsNumber = projectStore.projects.totalCount;

    if (!append) {
      nextPage.value = 2;
    }

    // Эмитим событие загрузки данных с актуальными ключами проектов
    const projectHashes = projectStore.projects.items.map(
      (project: any) => project.project_hash,
    );

    // Подсчитываем общее количество компонентов
    const totalComponents = projectStore.projects.items.reduce(
      (sum: number, project: any) => {
        return sum + (project.components?.length || 0);
      },
      0,
    );

    emit('dataLoaded', projectHashes, totalComponents);
  } catch (error) {
    console.error('Ошибка при загрузке проектов:', error);
    FailAlert('Не удалось загрузить список проектов');
  } finally {
    loading.value = false;
  }
};

// Функция обработки виртуального скролла
const onScroll = ({ to, ref }) => {
  if (!projects.value) {
    return;
  }
  const lastIndex = projects.value.items.length - 1;

  if (
    loading.value !== true &&
    nextPage.value <= lastPage.value &&
    to === lastIndex
  ) {
    // Сразу резервируем номер страницы: иначе loadProjects сбросит loading в finally
    // раньше, чем nextPage++, и виртуальный скролл может запросить ту же страницу повторно (дубли в append).
    const pageToLoad = nextPage.value;
    nextPage.value += 1;
    loading.value = true;

    setTimeout(() => {
      loadProjects(pageToLoad, true)
        .catch(() => {
          nextPage.value -= 1;
        })
        .finally(() => {
          loading.value = false;
          nextTick(() => {
            ref.refresh(); // Обновляем виртуальный скролл после загрузки
          });
        });
    }, 500); // Имитируем задержку загрузки
  }
};

// Функция сброса состояния бесконечного скролла
const resetScrollState = () => {
  nextPage.value = 1;
  lastPage.value = 1;
  // Очищаем store, чтобы сбросить projects (computed будет автоматически обновлен)
  projectStore.projects = {
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  };
};

const handleToggleExpand = (projectHash: string) => {
  emit('toggleExpand', projectHash);
};

const handleOpenProject = (projectHash: string) => {
  emit('openProject', projectHash);
};


// Загружаем данные при монтировании
onMounted(async () => {
  await loadProjects(1, false);
});

// Следим за изменениями фильтров и сбрасываем состояние
watch([() => props.statuses, () => props.priorities, () => props.hasIssuesWithStatuses, () => props.hasIssuesWithPriorities, () => props.master], () => {
  resetScrollState();
  loadProjects(1, false);
}, { deep: true });

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
    name: 'prefix',
    label: 'Префикс',
    align: 'left' as const,
    field: 'prefix' as const,
    sortable: true,
  },
  {
    name: 'name',
    label: 'Название',
    align: 'left' as const,
    field: 'title' as const,
    sortable: true,
  },
  {
    name: 'master',
    label: '',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'actions',
    label: '',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
];
</script>

<style lang="scss" scoped>
// Скелетон первичной загрузки — строки повторяют высоту строк списка
.projects-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4);

  .skel {
    height: var(--p-7);
  }
}

.projects-scroll-area {
  height: calc(100vh - 55px);
  overflow-y: auto;
}

// Структурные ширины колонок строки проекта (привязаны к
// virtual-scroll-item-size=48 — не spacing, токенам не подлежат)
.project-row {
  padding-left: var(--p-3);
  min-height: 48px;
}

.project-row__toggle {
  width: 35px;
  flex-shrink: 0;
}

.project-row__id {
  width: 100px;
  flex-shrink: 0;
}

.project-row__actions {
  width: 140px;
}

// Вложенный уровень (компоненты проекта) — отступ каскада задаёт родитель,
// сами виджеты при одиночном использовании отступа не имеют
.project-row__nested {
  padding: 0 0 0 var(--p-7) !important;

  @media (max-width: 640px) {
    padding-left: var(--p-3) !important;
  }
}

// Компактные метрики строки: часы факт/план, инвестиции
.row-meta-block {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-right: var(--p-3);

  @media (max-width: 640px) {
    display: none;
  }
}

.row-meta {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-3);
  white-space: nowrap;
}

// Канон-пустое состояние списка
.list-empty {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
  padding: var(--p-3) var(--p-4);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.q-table {
  tr {
    min-height: 48px;
  }

  .q-td {
    padding: 0; // строка использует внутренние отступы .project-row
  }
}

:deep(.list-item-title) {
  display: inline-block;
  vertical-align: top;
  word-wrap: break-word;
  white-space: normal;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--p-primary);
  }
}
</style>
