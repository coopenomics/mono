<template lang="pug">
//- Родитель раздела «Компоненты»: плоский список на корне, компонент/задача —
//- children через router-view (подсветка рейла живёт на name components-list).
router-view(v-if='!isListRoot')
.components-list-page(v-else)
  ComponentsTreeWidget(
    :key='reloadKey',
    :expanded='expanded',
    :statuses='statuses',
    :priorities='priorities',
    :master='master',
    :sort-by='sort.sortBy',
    :sort-order='sort.sortOrder',
    @toggle-expand='handleToggleExpand',
    @data-loaded='handleDataLoaded',
    @open-component='handleOpenComponent',
    @open-parent='handleOpenParent'
  )
    template(#component-content='{ component }')
      IssuesListWidget(
        :project-hash='component.project_hash',
        :can-manage-issues='!!component.permissions?.can_manage_issues',
        :is-private='component.origin === "local"',
        :compact='true',
        :sort-by='sort.sortBy',
        :sort-order='sort.sortOrder',
        @issue-click='handleIssueClick'
      )
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useExpandableState } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { ComponentsTreeWidget, IssuesListWidget } from 'app/extensions/capital/widgets';
import { FilterDialogWithButton, SortMenuButton } from 'app/extensions/capital/shared/ui';
import { CreateComponentHeaderButton } from 'app/extensions/capital/features/Project/CreateComponent';
import { useListPreferences } from 'app/extensions/capital/shared/lib';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';

const router = useRouter();
const route = useRoute();

/** Корень раздела, не вложенный компонент/задача. */
const isListRoot = computed(() => route.name === 'components-list');

// Свои фильтры и сортировка раздела — переживают перезагрузку
const { filters, sort } = useListPreferences('components');

// Созданный компонент перечитывает список: строка приходит с бэкенда
const reloadKey = ref(0);

// Фильтруем сами компоненты: задачи внутри не отсеиваем — для них отдельный
// раздел «Задачи» со своими фильтрами
const statuses = computed(() => filters.value.entityStatuses);
const priorities = computed(() => filters.value.entityPriorities);
const master = computed(() => filters.value.master);

// Развёрнутость строк раздела — своя, чтобы не путалась с мастерской
const COMPONENTS_EXPANDED_KEY = 'capital_components_list_expanded';

const {
  expanded,
  loadExpandedState,
  cleanupExpandedByKeys,
  toggleExpanded,
} = useExpandableState(COMPONENTS_EXPANDED_KEY);

const handleToggleExpand = (componentHash: string) => {
  toggleExpanded(componentHash);
};

const handleDataLoaded = (componentHashes: string[]) => {
  cleanupExpandedByKeys(componentHashes);
};

const handleOpenComponent = (componentHash: string) => {
  router.push({
    name: 'cmp-component-description',
    params: { project_hash: componentHash },
  });
};

const handleOpenParent = (parentHash: string) => {
  if (!parentHash) return;
  router.push({
    name: 'project-description',
    params: { project_hash: parentHash },
  });
};

const handleIssueClick = (issue: IIssue) => {
  router.push({
    name: 'cmp-component-issue-description',
    params: {
      project_hash: issue.project_hash,
      issue_hash: issue.issue_hash,
    },
  });
};

// Кнопки фильтров и сортировки живут в шапке — как на списке проектов
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

function registerListHeaderActions(): void {
  // Компонент создаётся из шапки — проект выбирается в самом диалоге
  registerHeaderAction({
    id: 'capital-components-create',
    component: CreateComponentHeaderButton,
    props: {
      onActionCompleted: () => {
        reloadKey.value += 1;
      },
    },
    order: 1,
  });
  registerHeaderAction({
    id: 'capital-components-filter',
    component: FilterDialogWithButton,
    props: { scope: 'components' },
    order: 2,
  });
  registerHeaderAction({
    id: 'capital-components-sort',
    component: SortMenuButton,
    props: { scope: 'components' },
    order: 3,
  });
}

onMounted(() => {
  loadExpandedState();
  if (isListRoot.value) registerListHeaderActions();
});

// При уходе во вложенный маршрут / возврате на список — шапка списка
watch(isListRoot, (isRoot) => {
  if (isRoot) registerListHeaderActions();
  else clearActions();
});

onBeforeUnmount(() => {
  clearActions();
});
</script>

<style lang="scss" scoped>
// Flex-колонка: список занимает остаток вьюпорта, скролл живёт внутри
// списка (virtual-scroll), низ не уезжает за экран
.components-list-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 55px);

  :deep(.components-tree-widget) {
    flex: 1;
    min-height: 0;
  }

  :deep(.components-scroll-area) {
    max-height: none;
  }
}
</style>
