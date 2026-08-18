<template lang="pug">
//- Фильтры применяются сразу, поэтому кнопки «Применить» нет: закрыть можно
//- крестиком или кликом мимо, выбор уже в силе
BaseDialog(
  v-model='isOpen'
  :title='dialogTitle'
  size='md'
)
  .filter-dialog
    //- Статусы самого проекта / компонента
    template(v-if='isEntityScope')
      .filter-dialog__field
        q-select(
          v-model='entityStatuses',
          :options='entityStatusOptions',
          option-value='value',
          option-label='label',
          emit-value,
          map-options,
          multiple,
          use-chips,
          stack-label,
          :label='isComponentsScope ? "Статусы компонентов" : "Статусы проектов"',
          outlined,
          dense
        )

      .filter-dialog__field
        ContributorSelector(
          v-model='selectedMaster',
          :coopname='coopname',
          label='Мастер',
          placeholder='',
          outlined,
          dense,
          :multiSelect='false'
        )
      .filter-dialog__field
        BaseCheckbox(
          v-model='onlyMyMaster'
          label='Где я мастер'
        )

    //- Список задач: фильтруем по самим задачам, дерево проектов сюда не мешаем
    template(v-else)
      .filter-dialog__field
        q-select(
          v-model='issueStatuses',
          :options='issueStatusOptions',
          option-value='value',
          option-label='label',
          emit-value,
          map-options,
          multiple,
          use-chips,
          stack-label,
          label='Статусы задач',
          outlined,
          dense
        )

      .filter-dialog__field
        q-select(
          v-model='issuePriorities',
          :options='issuePriorityOptions',
          option-value='value',
          option-label='label',
          emit-value,
          map-options,
          multiple,
          use-chips,
          stack-label,
          label='Приоритеты задач',
          outlined,
          dense
        )

      .filter-dialog__field
        ContributorSelector(
          v-model='selectedCreator',
          :project-hash='projectHash',
          :coopname='coopname',
          label='Исполнитель',
          placeholder='',
          outlined,
          dense,
          :multiSelect='false'
        )
      .filter-dialog__field
        BaseCheckbox(
          v-model='onlyMyIssues'
          label='Только мои задачи'
        )

      q-separator.filter-dialog__separator

      .filter-dialog__field
        ContributorSelector(
          v-model='selectedMaster',
          :coopname='coopname',
          label='Мастер компонента',
          placeholder='',
          outlined,
          dense,
          :multiSelect='false'
        )
      .filter-dialog__field
        BaseCheckbox(
          v-model='onlyMyMaster'
          label='Где я мастер'
        )

  template(#footer)
    BaseButton(variant='ghost', @click='handleReset') Сбросить
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { ContributorSelector } from 'app/extensions/capital/entities/Contributor';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { BaseDialog, BaseButton, BaseCheckbox } from 'src/shared/ui/base';
import type { IContributor } from 'app/extensions/capital/entities/Contributor/model/types';
import { getIssueStatusLabel } from 'app/extensions/capital/shared/lib/issueStatus';
import { getProjectStatusLabel } from 'app/extensions/capital/shared/lib/projectStatus';
import {
  useListPreferences,
  type CapitalListScope,
  type ICapitalListFilters,
} from 'app/extensions/capital/shared/lib/listPreferences';

const props = withDefaults(
  defineProps<{
    /** Какому списку принадлежат фильтры */
    scope: CapitalListScope;
    projectHash?: string;
    coopname?: string;
    title?: string;
  }>(),
  {
    scope: 'projects',
  },
);

const contributorStore = useContributorStore();
const { filters, setFilters, resetFilters } = useListPreferences(props.scope);

const isOpen = ref(false);

const isEntityScope = computed(() => props.scope !== 'issues');
const isComponentsScope = computed(() => props.scope === 'components');

const dialogTitle = computed(() => {
  if (props.title) return props.title;
  if (props.scope === 'issues') return 'Фильтры задач';
  if (props.scope === 'components') return 'Фильтры компонентов';
  return 'Фильтры проектов';
});

const selfUsername = computed(() => contributorStore.self?.username || '');

/** Участник по имени аккаунта: сохранённый фильтр помнит только username. */
const contributorByUsername = (username?: string): IContributor | null => {
  if (!username) return null;
  if (contributorStore.self?.username === username) return contributorStore.self;
  return { username } as IContributor;
};

/** Правка поля сразу уходит в настройки списка — список перечитывается на месте. */
const patch = (changes: Partial<ICapitalListFilters>) => {
  setFilters({ ...filters.value, ...changes });
};

const entityStatuses = computed({
  get: () => filters.value.entityStatuses,
  set: (value: string[]) => patch({ entityStatuses: [...value] }),
});

const issueStatuses = computed({
  get: () => filters.value.issueStatuses,
  set: (value: string[]) => patch({ issueStatuses: [...value] }),
});

const issuePriorities = computed({
  get: () => filters.value.issuePriorities,
  set: (value: string[]) => patch({ issuePriorities: [...value] }),
});

const selectedMaster = computed({
  get: () => contributorByUsername(filters.value.master),
  set: (value: IContributor | null) => patch({ master: value?.username || undefined }),
});

const selectedCreator = computed({
  get: () => contributorByUsername(filters.value.creators[0]),
  set: (value: IContributor | null) =>
    patch({ creators: value?.username ? [value.username] : [] }),
});

const onlyMyMaster = computed({
  get: () => !!filters.value.master && filters.value.master === selfUsername.value,
  set: (value: boolean) =>
    patch({ master: value ? selfUsername.value || undefined : undefined }),
});

const onlyMyIssues = computed({
  get: () =>
    filters.value.creators.length === 1 &&
    filters.value.creators[0] === selfUsername.value,
  set: (value: boolean) =>
    patch({ creators: value && selfUsername.value ? [selfUsername.value] : [] }),
});

const entityStatusOptions = computed(() =>
  [
    Zeus.ProjectStatus.PENDING,
    Zeus.ProjectStatus.ACTIVE,
    Zeus.ProjectStatus.VOTING,
    Zeus.ProjectStatus.RESULT,
    Zeus.ProjectStatus.FINALIZED,
  ].map((status) => ({ value: status, label: getProjectStatusLabel(status) })),
);

const issueStatusOptions = computed(() =>
  [
    Zeus.IssueStatus.BACKLOG,
    Zeus.IssueStatus.TODO,
    Zeus.IssueStatus.IN_PROGRESS,
    Zeus.IssueStatus.ON_REVIEW,
    Zeus.IssueStatus.DONE,
    Zeus.IssueStatus.CANCELED,
  ].map((status) => ({ value: status, label: getIssueStatusLabel(status) })),
);

const issuePriorityOptions = [
  { label: 'Срочный', value: Zeus.IssuePriority.URGENT },
  { label: 'Высокий', value: Zeus.IssuePriority.HIGH },
  { label: 'Средний', value: Zeus.IssuePriority.MEDIUM },
  { label: 'Низкий', value: Zeus.IssuePriority.LOW },
];

// Список задач фильтруется по самим задачам, дерево — по проектам и компонентам.
// Чужие для scope значения гасим, иначе они молча сужали бы выборку.
watch(
  isOpen,
  (opened) => {
    if (!opened) return;
    if (isEntityScope.value && (filters.value.issueStatuses.length
      || filters.value.issuePriorities.length
      || filters.value.creators.length)) {
      patch({ issueStatuses: [], issuePriorities: [], creators: [] });
    }
    if (!isEntityScope.value && filters.value.entityStatuses.length) {
      patch({ entityStatuses: [] });
    }
  },
  { immediate: false },
);

const openDialog = () => {
  isOpen.value = true;
};

const closeDialog = () => {
  isOpen.value = false;
};

const handleReset = () => {
  resetFilters();
  closeDialog();
};

defineExpose({
  openDialog,
  closeDialog,
});
</script>

<style lang="scss" scoped>
.filter-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.filter-dialog__separator {
  margin-top: var(--p-2);
}
</style>
