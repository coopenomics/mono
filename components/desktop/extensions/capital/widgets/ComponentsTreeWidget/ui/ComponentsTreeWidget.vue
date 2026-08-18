<template lang="pug">
.components-tree-widget
  // Скелетон первичной загрузки (догрузка страниц идёт молча)
  .components-skeleton(v-if='isInitialLoading')
    .skel(v-for='i in 8', :key='i')

  .components-scroll-area(v-else)
    // Список — плоские строки компонентов; таблица здесь не нужна:
    // строка одна на всех уровнях дерева, а под ней раскрывается контент
    // переменной высоты (задачи компонента)
    template(v-for='component in components.items', :key='component.project_hash')
      ComponentListRow.component-row--root(
        :component='component',
        :expanded='expanded[component.project_hash]',
        :is-private='component.origin === "local"',
        show-parent,
        @toggle='emit("toggleExpand", component.project_hash)',
        @open='emit("openComponent", component.project_hash)',
        @open-parent='emit("openParent", component.parent_hash || "")'
      )
      .component-row__nested(v-if='expanded[component.project_hash]')
        slot(name='component-content', :component='component')

    // Канон-пустое состояние
    .list-empty(v-if='!components.items.length')
      q-icon(name='inbox', size='20px')
      span {{ hasFiltersApplied ? 'Нет результатов по фильтрам' : 'Нет компонентов' }}

    // Сентинел догрузки: попал в вид — тянем следующую страницу
    .components-sentinel(v-if='hasMorePages', ref='sentinelRef')
      q-spinner(v-if='loading', size='18px', color='primary')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import type { IGetProjectsInput } from 'app/extensions/capital/entities/Project/model';
import { ComponentListRow } from 'app/extensions/capital/widgets/ComponentsListWidget';

type IProjectsFilter = NonNullable<IGetProjectsInput['filter']>;

const props = defineProps<{
  coopname?: string;
  expanded: Record<string, boolean>;
  /** Фильтр по статусам компонентов */
  statuses?: string[];
  /** Показывать только компоненты указанного мастера */
  master?: string;
  /** blockchain | local | any — по умолчанию backend режет blockchain */
  origin?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}>();

const emit = defineEmits<{
  toggleExpand: [componentHash: string];
  openComponent: [componentHash: string];
  openParent: [parentHash: string];
  dataLoaded: [componentHashes: string[]];
}>();

const { info } = useSystemStore();
const projectStore = useProjectStore();

const loading = ref(false);
const nextPage = ref(1);
const lastPage = ref(1);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const components = computed(() => projectStore.components);

const hasFiltersApplied = computed(
  () => (props.statuses?.length ?? 0) > 0 || !!props.master,
);

const isInitialLoading = computed(
  () => loading.value && components.value.items.length === 0,
);

const hasMorePages = computed(() => nextPage.value <= lastPage.value);

const loadComponents = async (page = 1, append = false) => {
  loading.value = true;

  try {
    const filter: IProjectsFilter = {
      coopname: props.coopname || info.coopname,
      // Плоский список: только компоненты, без первого уровня проектов
      is_component: true,
    };

    if (props.statuses?.length) {
      filter.statuses = props.statuses as IProjectsFilter['statuses'];
    }
    if (props.master) {
      filter.master = props.master;
    }
    if (props.origin) {
      filter.origin = props.origin;
    }

    await projectStore.loadComponents(
      {
        filter,
        options: {
          page,
          limit: 25,
          sortBy: props.sortBy || '_created_at',
          sortOrder: props.sortOrder || 'DESC',
        },
      },
      append,
    );

    lastPage.value = projectStore.components.totalPages || 1;
    nextPage.value = page + 1;

    emit(
      'dataLoaded',
      projectStore.components.items.map((component) => component.project_hash),
    );
  } catch (error) {
    console.error('Ошибка при загрузке компонентов:', error);
    FailAlert('Не удалось загрузить список компонентов');
  } finally {
    loading.value = false;
  }
};

const loadNextPage = () => {
  if (loading.value || !hasMorePages.value) return;
  void loadComponents(nextPage.value, true);
};

/** Наблюдатель за сентинелом переустанавливается: элемент исчезает на последней странице. */
const observeSentinel = async () => {
  await nextTick();
  observer?.disconnect();
  if (!sentinelRef.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextPage();
    },
    { rootMargin: '200px' },
  );
  observer.observe(sentinelRef.value);
};

const resetList = () => {
  nextPage.value = 1;
  lastPage.value = 1;
  projectStore.components = {
    items: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  };
};

onMounted(async () => {
  await loadComponents(1, false);
  await observeSentinel();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

// Смена фильтров и сортировки перечитывает список с первой страницы
watch(
  [() => props.statuses, () => props.master, () => props.sortBy, () => props.sortOrder],
  async () => {
    resetList();
    await loadComponents(1, false);
    await observeSentinel();
  },
  { deep: true },
);

// Список вырос — сентинел уехал вниз, наблюдателя переустанавливаем
watch(
  () => components.value.items.length,
  () => {
    void observeSentinel();
  },
);
</script>

<style lang="scss" scoped>
// Скелетон первичной загрузки — строки повторяют высоту строк списка
.components-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4);
  background: var(--p-surface);

  .skel {
    height: var(--p-7);
  }
}

.components-tree-widget {
  height: 100%;
  min-height: 0;
  background: var(--p-surface);
}

.components-scroll-area {
  height: 100%;
  max-height: calc(100vh - 55px);
  overflow-y: auto;
}

// Корневой уровень списка — свой левый отступ, как у строк проектов
// в мастерской (у вложенной строки компонента его задаёт родитель)
.component-row--root {
  padding-left: var(--p-3);
}

// Вложенный уровень (задачи компонента) — отступ каскада.
// Вертикальная линия по оси chevron'а — «горизонт» вложения
.component-row__nested {
  position: relative;
  padding-left: var(--p-7);
  min-width: 0;

  &::before {
    content: '';
    position: absolute;
    left: 13px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--p-line);
  }

  @media (max-width: 640px) {
    padding-left: var(--p-4);

    &::before {
      left: 7px;
    }
  }
}

.components-sentinel {
  display: flex;
  justify-content: center;
  padding: var(--p-3);
  min-height: var(--p-6);
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
