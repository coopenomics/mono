<template lang="pug">
PriorityControl(
  :model-value='displayPriority'
  :readonly='readonly'
  :saving='isSaving'
  :variant='variant'
  @select='onSelect'
)
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { PriorityControl } from 'app/extensions/capital/shared/ui';
import { useUpdateIssue } from '../../model';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    issueHash: string;
    /** Явный hash проекта/компонента — на вложенных списках в URL нет project_hash */
    projectHash?: string | null;
    readonly?: boolean;
    variant?: 'chip' | 'icon';
  }>(),
  {
    readonly: false,
    variant: 'icon',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const route = useRoute();
const resolvedProjectHash = computed(
  () => props.projectHash || (route.params.project_hash as string) || '',
);

const { saveImmediately } = useUpdateIssue();
const issueStore = useIssueStore();

// Оптимистичное локальное значение — как у IssueStatusChip
const optimisticPriority = ref<string | null>(null);
const isSaving = ref(false);

watch(
  () => props.modelValue,
  (next) => {
    if (optimisticPriority.value && next === optimisticPriority.value) {
      optimisticPriority.value = null;
    }
  },
);

const displayPriority = computed(() => optimisticPriority.value ?? props.modelValue);

const onSelect = async (value: string) => {
  const previous = props.modelValue;
  optimisticPriority.value = value;
  emit('update:modelValue', value);
  isSaving.value = true;

  try {
    await saveImmediately(
      { issue_hash: props.issueHash, priority: value as Zeus.IssuePriority },
      resolvedProjectHash.value,
    );
    await issueStore.updateIssueByHash(resolvedProjectHash.value, props.issueHash);
  } catch (error) {
    optimisticPriority.value = null;
    emit('update:modelValue', previous);
    FailAlert(error);
  } finally {
    isSaving.value = false;
  }
};
</script>
