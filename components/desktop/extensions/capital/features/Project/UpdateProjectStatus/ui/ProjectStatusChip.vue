<template lang="pug">
//- Инлайн-смена статуса проекта/компонента из строки списка — тот же рисунок,
//- что у смены статуса задачи: чип с русской подписью + меню
.project-status-chip(@click.stop)
  .project-status-chip__trigger(:class='{ "project-status-chip__trigger--readonly": isReadonly }')
    BaseChip.project-status-chip__chip(:variant='chipVariant' size='sm')
      q-spinner.q-mr-xs(v-if='isSaving' size='12px')
      span.project-status-chip__label {{ label }}
      q-icon.q-ml-xs(v-if='!isReadonly' name='arrow_drop_down' size='xs')
    q-tooltip(anchor='bottom middle' self='top middle') Статус: {{ label }}
    InlineSelectMenu(
      v-if='!isReadonly'
      title='Сменить статус'
      :options='menuOptions'
      :current='displayStatus'
      @select='onSelect'
    )
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { BaseChip } from 'src/shared/ui/base';
import { InlineSelectMenu } from 'app/extensions/capital/shared/ui/InlineSelectMenu';
import {
  PROJECT_STATUS_OPTIONS,
  getProjectStatusLabel,
  getProjectStatusColor,
  getProjectStatusChipVariant,
} from 'app/extensions/capital/shared/lib';
import { useUpdateProjectStatus } from '../model';
import type { IProject, IProjectComponent } from 'app/extensions/capital/entities/Project/model';

const props = defineProps<{
  project: IProject | IProjectComponent;
}>();

const { updateProjectStatus } = useUpdateProjectStatus();

// Оптимистичное локальное значение — как у смены статуса задачи:
// чип перекрашивается сразу, сбрасывается, когда стор догнал
const optimisticStatus = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.project.status,
  (next) => {
    if (optimisticStatus.value && next === optimisticStatus.value) {
      optimisticStatus.value = null;
    }
  },
);

const displayStatus = computed(() => optimisticStatus.value ?? props.project.status);

const isReadonly = computed(
  () => !props.project.permissions?.can_change_project_status,
);

const label = computed(() => getProjectStatusLabel(displayStatus.value));
const chipVariant = computed(() => getProjectStatusChipVariant(displayStatus.value));

const menuOptions = PROJECT_STATUS_OPTIONS.map((opt) => ({
  ...opt,
  icon: 'circle',
  iconColor: getProjectStatusColor(opt.value),
  iconSize: '10px',
}));

const onSelect = async (value: string) => {
  if (value === displayStatus.value) return;
  optimisticStatus.value = value;
  isSaving.value = true;
  try {
    // Стор обновляется внутри updateProjectStatus (addProjectToList)
    await updateProjectStatus(
      props.project.project_hash,
      value as Zeus.ProjectStatus,
      (props.project as IProject).coopname || '',
    );
  } catch (error) {
    optimisticStatus.value = null;
    FailAlert(error);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style lang="scss" scoped>
.project-status-chip {
  display: inline-flex;
  align-items: center;
}

.project-status-chip__trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;

  &--readonly {
    cursor: default;
  }
}

.project-status-chip__chip {
  margin: 0;
}

.project-status-chip__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
</style>
