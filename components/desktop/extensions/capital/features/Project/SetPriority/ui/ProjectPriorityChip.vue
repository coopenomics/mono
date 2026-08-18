<template lang="pug">
PriorityControl(
  :model-value='displayPriority'
  :readonly='isReadonly'
  :saving='isSaving'
  variant='chip'
  @select='onSelect'
)
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { PriorityControl } from 'app/extensions/capital/shared/ui';
import { useSetProjectPriority } from '../model';
import type { IProject, IProjectComponent } from 'app/extensions/capital/entities/Project/model';

const props = defineProps<{
  project: IProject | IProjectComponent;
}>();

const { setProjectPriority } = useSetProjectPriority();

// Оптимистичное локальное значение: чип перекрашивается сразу после клика,
// сбрасывается, когда стор догнал (props.project.priority совпал)
const optimisticPriority = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.project.priority,
  (next) => {
    if (optimisticPriority.value && next === optimisticPriority.value) {
      optimisticPriority.value = null;
    }
  },
);

const displayPriority = computed(
  () => optimisticPriority.value ?? props.project.priority,
);

const isReadonly = computed(
  () => !props.project.permissions?.can_set_priority,
);

const onSelect = async (value: string) => {
  optimisticPriority.value = value;
  isSaving.value = true;
  try {
    await setProjectPriority({
      project_hash: props.project.project_hash,
      priority: value as Zeus.ProjectPriority,
    });
  } catch (error) {
    optimisticPriority.value = null;
    FailAlert(error);
  } finally {
    isSaving.value = false;
  }
};
</script>
