<template lang="pug">
BaseDialog(
  v-model='isOpen'
  :title='dialogTitle'
  size='md'
)
  .filter-dialog
    //- Статусы самого проекта / компонента
    .filter-dialog__field(v-if='isEntityScope')
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

    //- Мастер — ведущий проекта / компонента
    .filter-dialog__field
      ContributorSelector(
        v-model='selectedMaster',
        :project-hash='projectHash',
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

    q-separator.filter-dialog__separator(v-if='isEntityScope')
    .filter-dialog__section-title(v-if='isEntityScope') Задачи внутри

    //- Статусы задач
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

    //- Приоритеты задач
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

    //- Исполнитель задач
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
        :label='isEntityScope ? "Где я исполнитель" : "Только мои задачи"'
      )

  template(#footer)
    BaseButton(variant='ghost', @click='handleReset') Сбросить
    BaseButton(variant='primary', @click='handleSubmit') Применить
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

// Локальное состояние формы — применяется в настройки только по «Применить»
const entityStatuses = ref<string[]>([]);
const issueStatuses = ref<string[]>([]);
const issuePriorities = ref<string[]>([]);
const selectedMaster = ref<IContributor | null>(null);
const selectedCreator = ref<IContributor | null>(null);
const onlyMyMaster = ref(false);
const onlyMyIssues = ref(false);

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

const selfUsername = computed(() => contributorStore.self?.username || '');

/** Участник по имени аккаунта: сохранённый фильтр помнит только username. */
const contributorByUsername = (username?: string): IContributor | null => {
  if (!username) return null;
  if (contributorStore.self?.username === username) return contributorStore.self;
  return { username } as IContributor;
};

/** Перечитать форму из сохранённых настроек (при каждом открытии). */
const syncFromPreferences = () => {
  const saved = filters.value;
  entityStatuses.value = [...saved.entityStatuses];
  issueStatuses.value = [...saved.issueStatuses];
  issuePriorities.value = [...saved.issuePriorities];
  selectedMaster.value = contributorByUsername(saved.master);
  selectedCreator.value = contributorByUsername(saved.creators[0]);
  onlyMyMaster.value = !!saved.master && saved.master === selfUsername.value;
  onlyMyIssues.value =
    saved.creators.length === 1 && saved.creators[0] === selfUsername.value;
};

// Галочка «я» и выбор участника — две стороны одного значения
watch(onlyMyMaster, (isSelf) => {
  if (isSelf) {
    selectedMaster.value = contributorByUsername(selfUsername.value);
  } else if (selectedMaster.value?.username === selfUsername.value) {
    selectedMaster.value = null;
  }
});

watch(selectedMaster, (master) => {
  onlyMyMaster.value = !!master && master.username === selfUsername.value;
});

watch(onlyMyIssues, (isSelf) => {
  if (isSelf) {
    selectedCreator.value = contributorByUsername(selfUsername.value);
  } else if (selectedCreator.value?.username === selfUsername.value) {
    selectedCreator.value = null;
  }
});

watch(selectedCreator, (creator) => {
  onlyMyIssues.value = !!creator && creator.username === selfUsername.value;
});

const openDialog = () => {
  syncFromPreferences();
  isOpen.value = true;
};

const closeDialog = () => {
  isOpen.value = false;
};

const handleSubmit = () => {
  const next: ICapitalListFilters = {
    entityStatuses: isEntityScope.value ? [...entityStatuses.value] : [],
    issueStatuses: [...issueStatuses.value],
    issuePriorities: [...issuePriorities.value],
    creators: selectedCreator.value?.username ? [selectedCreator.value.username] : [],
    master: selectedMaster.value?.username || undefined,
  };
  setFilters(next);
  closeDialog();
};

const handleReset = () => {
  resetFilters();
  syncFromPreferences();
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
  gap: var(--p-3);
}

.filter-dialog__separator {
  margin-top: var(--p-2);
}

.filter-dialog__section-title {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
}
</style>
