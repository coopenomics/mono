<template lang="pug">
.projects-filter-panel
  //- Компактные инпуты фильтров — применяются сразу, без кнопки «Применить»
  q-select.fp-select(
    v-model='selectedStatuses',
    :options='statusOptions',
    option-value='value',
    option-label='label',
    emit-value,
    map-options,
    multiple,
    outlined,
    dense,
    color='primary',
    label='Статусы задач',
    :display-value='statusesDisplay'
  )
  q-select.fp-select(
    v-model='selectedPriorities',
    :options='priorityOptions',
    option-value='value',
    option-label='label',
    emit-value,
    map-options,
    multiple,
    outlined,
    dense,
    color='primary',
    label='Приоритеты',
    :display-value='prioritiesDisplay'
  )
  .fp-contributor
    ContributorSelector(
      v-model='selectedCreator',
      :multi-select='false',
      dense,
      outlined,
      label='Исполнитель',
      placeholder=''
    )
  .fp-contributor
    ContributorSelector(
      v-model='selectedMaster',
      :multi-select='false',
      dense,
      outlined,
      label='Мастер',
      placeholder=''
    )

  BaseButton.fp-reset(
    v-if='hasActiveFilters',
    variant='ghost',
    size='sm',
    @click='resetFilters'
  )
    template(#icon-left)
      q-icon(name='close', size='16px')
    | Сбросить
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton } from 'src/shared/ui/base';
import { ContributorSelector } from 'app/extensions/capital/entities/Contributor';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { getIssueStatusLabel } from 'app/extensions/capital/shared/lib/issueStatus';
import type { IContributor } from 'app/extensions/capital/entities/Contributor/model';

const projectStore = useProjectStore();
const contributorStore = useContributorStore();

const selectedStatuses = ref<string[]>([...projectStore.projectFilters.statuses]);
const selectedPriorities = ref<string[]>([...projectStore.projectFilters.priorities]);
const selectedCreator = ref<IContributor | null>(null);
const selectedMaster = ref<IContributor | null>(null);
// Восстановление исполнителя/мастера из store идёт асинхронно — на это время
// глушим watcher, чтобы не перезаписать фильтры промежуточным состоянием
const isRestoring = ref(false);

const statusOptions = computed(() => [
  { label: getIssueStatusLabel(Zeus.IssueStatus.BACKLOG), value: Zeus.IssueStatus.BACKLOG },
  { label: getIssueStatusLabel(Zeus.IssueStatus.TODO), value: Zeus.IssueStatus.TODO },
  { label: getIssueStatusLabel(Zeus.IssueStatus.IN_PROGRESS), value: Zeus.IssueStatus.IN_PROGRESS },
  { label: getIssueStatusLabel(Zeus.IssueStatus.ON_REVIEW), value: Zeus.IssueStatus.ON_REVIEW },
  { label: getIssueStatusLabel(Zeus.IssueStatus.DONE), value: Zeus.IssueStatus.DONE },
  { label: getIssueStatusLabel(Zeus.IssueStatus.CANCELED), value: Zeus.IssueStatus.CANCELED },
]);

const priorityOptions = [
  { label: 'Срочный', value: Zeus.IssuePriority.URGENT },
  { label: 'Высокий', value: Zeus.IssuePriority.HIGH },
  { label: 'Средний', value: Zeus.IssuePriority.MEDIUM },
  { label: 'Низкий', value: Zeus.IssuePriority.LOW },
];

const statusesDisplay = computed(() => {
  const n = selectedStatuses.value.length;
  if (n === 0) return '';
  if (n === 1) {
    return statusOptions.value.find((o) => o.value === selectedStatuses.value[0])?.label ?? '';
  }
  return `Выбрано: ${n}`;
});

const prioritiesDisplay = computed(() => {
  const n = selectedPriorities.value.length;
  if (n === 0) return '';
  if (n === 1) {
    return priorityOptions.find((o) => o.value === selectedPriorities.value[0])?.label ?? '';
  }
  return `Выбрано: ${n}`;
});

const hasActiveFilters = computed(
  () =>
    selectedStatuses.value.length > 0 ||
    selectedPriorities.value.length > 0 ||
    !!selectedCreator.value ||
    !!selectedMaster.value,
);

const applyFilters = () => {
  projectStore.setProjectFilters({
    statuses: [...selectedStatuses.value],
    priorities: [...selectedPriorities.value],
    creators: selectedCreator.value?.username ? [selectedCreator.value.username] : [],
    master: selectedMaster.value?.username || undefined,
  });
};

watch(
  [selectedStatuses, selectedPriorities, selectedCreator, selectedMaster],
  () => {
    if (isRestoring.value) return;
    applyFilters();
  },
  { deep: true },
);

const resetFilters = () => {
  isRestoring.value = true;
  selectedStatuses.value = [];
  selectedPriorities.value = [];
  selectedCreator.value = null;
  selectedMaster.value = null;
  isRestoring.value = false;
  applyFilters();
};

// Восстанавливаем исполнителя/мастера из сохранённых фильтров
onMounted(async () => {
  const { creators, master } = projectStore.projectFilters;
  if (!creators.length && !master) return;
  isRestoring.value = true;
  try {
    if (creators.length) {
      selectedCreator.value =
        (await contributorStore.loadContributor({ username: creators[0] })) ?? null;
    }
    if (master) {
      selectedMaster.value =
        (await contributorStore.loadContributor({ username: master })) ?? null;
    }
  } catch (error) {
    console.error('ProjectsFilterPanel: restore contributors failed', error);
  } finally {
    isRestoring.value = false;
  }
});
</script>

<style lang="scss" scoped>
.projects-filter-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-3);
  border-bottom: 1px solid var(--p-line);
  background: var(--p-surface);
}

.fp-select {
  width: 180px;
}

.fp-contributor {
  width: 200px;
}

.fp-reset {
  margin-left: auto;
}

@media (max-width: 640px) {
  .fp-select,
  .fp-contributor {
    width: calc(50% - var(--p-2));
  }

  .fp-reset {
    margin-left: 0;
  }
}
</style>
