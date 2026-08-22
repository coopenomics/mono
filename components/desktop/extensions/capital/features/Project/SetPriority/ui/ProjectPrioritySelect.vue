<template lang="pug">
BaseSelect(
  :model-value='selectedPriority'
  :options='priorityOptions'
  :label='label'
  :disabled='isReadonly'
  @update:model-value='handlePriorityChange'
)
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { BaseSelect } from 'src/shared/ui/base';
import { ISSUE_PRIORITY_OPTIONS } from 'app/extensions/capital/shared/lib';
import { useSetProjectPriority } from '../model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';

const props = withDefaults(
  defineProps<{
    project: IProject | null | undefined;
    label?: string;
  }>(),
  {
    label: 'Приоритет',
  },
);

const { setProjectPriority } = useSetProjectPriority();

const priorityOptions = ISSUE_PRIORITY_OPTIONS;

const selectedPriority = ref<string>(props.project?.priority || Zeus.ProjectPriority.MEDIUM);

const isReadonly = computed(() => !props.project?.permissions?.can_set_priority);

const handlePriorityChange = async (newPriority: string | number | null) => {
  if (!props.project || !newPriority || newPriority === props.project.priority) return;
  const previous = props.project.priority;
  selectedPriority.value = String(newPriority);
  try {
    await setProjectPriority({
      project_hash: props.project.project_hash,
      priority: newPriority as Zeus.ProjectPriority,
    });
  } catch (error) {
    selectedPriority.value = previous;
    FailAlert(error);
  }
};

watch(
  () => props.project?.priority,
  (next) => {
    if (next) selectedPriority.value = next;
  },
);
</script>
