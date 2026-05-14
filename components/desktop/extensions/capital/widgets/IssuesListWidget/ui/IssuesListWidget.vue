<template lang="pug">
div
  q-card(flat)
    q-card-section(style='padding: 0px')
      //- Полноэкранный режим с виртуальным скроллом (для отдельных страниц)
      .issues-scroll-area(
        v-if='!compact',
        style='height: calc(100vh - 55px); overflow-y: auto'
      )
        q-table(
          ref='tableRef',
          :rows='issues?.items || []',
          :columns='columns',
          row-key='_id',
          :pagination='pagination',
          :loading='onLoading',
          flat,
          square,
          hide-header,
          hide-pagination,
          virtual-scroll,
          @virtual-scroll='onScroll',
          :virtual-scroll-target='".issues-scroll-area"',
          :virtual-scroll-item-size='48',
          :virtual-scroll-sticky-size-start='48',
          :rows-per-page-options='[0]',
          no-data-label="Нет задач"
        )
          template(#body='props')
            q-tr(:props='props')
              q-td
                IssueListRow(
                  :issue='props.row'
                  @click='handleIssueClick'
                )

      //- Компактный режим без фиксированной высоты (для вложенного использования)
      div(v-else)
        q-table(
          :rows='issues?.items || []',
          :columns='columns',
          row-key='_id',
          :pagination='compactPagination',
          :loading='loading',
          flat,
          square,
          hide-header,
          hide-pagination,
          :rows-per-page-options='[0]',
          no-data-label="Нет задач"
        )
          template(#body='props')
            q-tr(:props='props')
              q-td
                IssueListRow(
                  :issue='props.row'
                  @click='handleIssueClick'
                )

</template>
<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import {
  type IIssue,
  useIssueStore,
} from 'app/extensions/capital/entities/Issue/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import IssueListRow from './IssueListRow.vue';

const props = defineProps<{
  projectHash: string;
  statuses?: string[];
  priorities?: string[];
  master?: string;
  creators?: string[];
  compact?: boolean;
}>();

const emit = defineEmits<{
  issueClick: [issue: IIssue];
}>();

const issueStore = useIssueStore();
const { info } = useSystemStore();

const loading = ref(false);
const onLoading = ref(false);
const tableRef = ref(null);
const nextPage = ref(1);
const lastPage = ref(0);

// Пагинация для виртуального скролла (полноэкранный режим)
const pagination = ref({
  sortBy: '_created_at',
  descending: true,
  page: 1,
  rowsPerPage: 0,
  rowsNumber: 0,
});

// Пагинация для компактного режима (показываем все загруженные элементы)
const compactPagination = ref({
  sortBy: '_created_at',
  descending: true,
  page: 1,
  rowsPerPage: 0,
});

// Реактивная связь с store вместо локального копирования
const issues = computed(() => issueStore.getProjectIssues(props.projectHash));

// Следим за изменениями projectHash и перезагружаем задачи
watch(() => props.projectHash, async (newProjectHash, oldProjectHash) => {
  if (newProjectHash && newProjectHash !== oldProjectHash) {
    resetScrollState();
    await loadIssues(1, false);
  }
});

// Следим за изменениями фильтров и сбрасываем состояние
watch([() => props.statuses, () => props.priorities, () => props.creators, () => props.master], () => {
  resetScrollState();
  loadIssues(1, false);
}, { deep: true });

// Функция обработки виртуального скролла
const onScroll = ({ to, ref }) => {
  if (!issues.value) {
    return;
  }
  const lastIndex = issues.value.items.length - 1;

  if (
    loading.value !== true &&
    onLoading.value !== true &&
    nextPage.value <= lastPage.value &&
    to === lastIndex
  ) {
    // Резервируем номер страницы до завершения запроса: иначе loadIssues в finally
    // сбросит onLoading раньше nextPage++, виртуальный скролл может запросить ту же страницу снова.
    const pageToLoad = nextPage.value;
    nextPage.value += 1;
    onLoading.value = true;

    setTimeout(() => {
      if (pageToLoad > lastPage.value || loading.value) {
        nextPage.value -= 1;
        onLoading.value = false;
        return;
      }

      loadIssues(pageToLoad, true)
        .catch(() => {
          nextPage.value -= 1;
        })
        .finally(() => {
          onLoading.value = false;
          nextTick(() => {
            ref.refresh();
          });
        });
    }, 500);
  }
};

// Функция сброса состояния бесконечного скролла
const resetScrollState = () => {
  nextPage.value = 1;
  lastPage.value = 0;
  pagination.value.rowsNumber = 0;
};

// Определяем столбцы таблицы задач
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'id',
    label: 'ID',
    align: 'left' as const,
    field: 'id' as const,
    sortable: true,
  },
  {
    name: 'title',
    label: 'Задача',
    align: 'left' as const,
    field: 'title' as const,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Статус',
    align: 'right' as const,
    field: 'status' as const,
    sortable: true,
  },
];

// Загрузка задач компонента
const loadIssues = async (page = 1, append = false) => {
  if (!append) {
    loading.value = true;
  } else {
    onLoading.value = true;
  }

  try {
    const filter: any = {
      coopname: info.coopname,
      project_hash: props.projectHash,
    };

    // Добавляем дополнительные фильтры, если они переданы
    if (props.statuses?.length) {
      filter.statuses = props.statuses;
    }
    if (props.priorities?.length) {
      filter.priorities = props.priorities;
    }
    if (props.creators?.length) {
      filter.creators = props.creators;
    }
    if (props.master) {
      filter.master = props.master;
    }

    await issueStore.loadIssues({
      filter,
      options: {
        page,
        limit: props.compact ? 50 : 5, // В компактном режиме загружаем больше, в полноэкранном - постранично
        sortBy: '_created_at',
        sortOrder: 'DESC',
      },
    }, props.projectHash, append); // Передаем projectHash и флаг append для объединения результатов

    if (issues.value) {
      lastPage.value = issues.value.totalPages || 1;
      pagination.value.rowsNumber = issues.value.totalCount;

      if (!append) {
        nextPage.value = 2;
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке задач компонента:', error);
    FailAlert('Не удалось загрузить задачи компонента');
  } finally {
    loading.value = false;
    onLoading.value = false;
  }
};


// Обработчик клика по заголовку задачи
const handleIssueClick = (issue: IIssue) => {
  emit('issueClick', issue);
};

// Инициализация
onMounted(async () => {
  await loadIssues(1, false);
});

</script>

<style lang="scss" scoped>
// table-layout: fixed + width: 100% — иначе html-table ужимает колонки под
// контент: длинный title распирает строку шире контейнера, actions-блок
// уезжает за правый край (наблюдалось на ComponentTasksPage с боковой панелью).
.q-table {
  table-layout: fixed;
  width: 100%;

  tr {
    min-height: 48px;
  }

  .q-td {
    padding: 0; // строка живёт в IssueListRow.vue со своими отступами
    overflow: hidden;
  }
}
</style>
