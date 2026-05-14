<template lang="pug">
.issue-status-chip(@click.stop)
  q-chip(
    :color='chipColor'
    text-color='white'
    :clickable='!isReadonly'
    dense
    square
    size='sm'
    class='status-chip-trigger'
  )
    q-spinner(v-if='isSaving', size='12px', color='white', class='q-mr-xs')
    span.status-chip-label {{ currentLabel }}
    q-icon(
      v-if='!isReadonly && hasTransitions'
      name='arrow_drop_down'
      size='xs'
      class='q-ml-xs'
    )
    q-menu(
      v-if='!isReadonly && hasTransitions'
      anchor='bottom right'
      self='top right'
      auto-close
      :offset='[0, 6]'
    )
      .status-menu
        .status-menu-header Сменить статус
        q-list.status-menu-list
          q-item.status-menu-item(
            v-for='opt in statusOptions'
            :key='opt.value'
            clickable
            v-close-popup
            @click='handleStatusChange(opt)'
          )
            q-item-section(avatar, style='min-width: 28px')
              q-icon(
                name='circle'
                :color='statusColorOf(opt.value)'
                size='10px'
              )
            q-item-section
              .status-menu-label {{ opt.label }}
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';

import { useUpdateIssue } from '../../model';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';
import {
  getIssueStatusLabel,
  getIssueStatusColor,
} from 'app/extensions/capital/shared/lib';

interface Props {
  modelValue: Zeus.IssueStatus;
  issueHash: string;
  readonly?: boolean;
  allowedTransitions?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: Zeus.IssueStatus): void;
}>();

const route = useRoute();
const projectHash = computed(() => route.params.project_hash as string);

const { saveImmediately } = useUpdateIssue();
const issueStore = useIssueStore();

// Оптимистичное локальное значение: показываем сразу после клика, не ждём
// возврата store из бэка. Сбрасываем как только parent догнал переключение
// (props.modelValue поменялся на ту же букву).
const optimisticStatus = ref<Zeus.IssueStatus | null>(null);
const isSaving = ref(false);

watch(
  () => props.modelValue,
  (next) => {
    if (optimisticStatus.value && next === optimisticStatus.value) {
      optimisticStatus.value = null;
    }
  }
);

const displayStatus = computed(
  () => optimisticStatus.value ?? props.modelValue
);

const ALL_STATUS_OPTIONS = [
  Zeus.IssueStatus.BACKLOG,
  Zeus.IssueStatus.TODO,
  Zeus.IssueStatus.IN_PROGRESS,
  Zeus.IssueStatus.ON_REVIEW,
  Zeus.IssueStatus.DONE,
  Zeus.IssueStatus.CANCELED,
].map((value) => ({ value, label: getIssueStatusLabel(value) }));

const hasTransitions = computed(
  () => (props.allowedTransitions ?? []).length > 0
);

const isReadonly = computed(() => props.readonly || !hasTransitions.value);

const statusOptions = computed(() =>
  ALL_STATUS_OPTIONS.filter((opt) =>
    (props.allowedTransitions ?? []).includes(opt.value as Zeus.IssueStatus)
  )
);

const currentLabel = computed(() => getIssueStatusLabel(displayStatus.value));
const chipColor = computed(() => getIssueStatusColor(displayStatus.value));

const statusColorOf = (s: string) => getIssueStatusColor(s);

const handleStatusChange = async (option: {
  value: Zeus.IssueStatus;
  label: string;
}) => {
  if (option.value === displayStatus.value) return;
  const previousStatus = props.modelValue;

  // 1) Оптимистично обновляем UI сразу — chip перекрашивается до round-trip.
  optimisticStatus.value = option.value;
  emit('update:modelValue', option.value);
  isSaving.value = true;

  try {
    // 2) Сохраняем без debounce — статус это discrete действие, не текстовый ввод.
    await saveImmediately(
      { issue_hash: props.issueHash, status: option.value },
      projectHash.value
    );
    // 3) Перезагружаем задачу для свежих permissions/allowed_transitions.
    //    Watch на props.modelValue сбросит optimisticStatus, когда придёт новое значение.
    await issueStore.updateIssueByHash(projectHash.value, props.issueHash);
  } catch (error) {
    console.error('IssueStatusChip: failed to update status', error);
    optimisticStatus.value = null;
    emit('update:modelValue', previousStatus);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style lang="scss" scoped>
.issue-status-chip {
  display: inline-flex;
  align-items: center;
}

.status-chip-trigger {
  font-weight: 500;
  font-size: 11px;
  padding: 0 8px;
  height: 22px;
  margin: 0;

  .status-chip-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 110px;
  }
}

// Меню смены статуса — внутренние отступы, hover, разделители.
.status-menu {
  min-width: 200px;
  padding: 6px;
  background-color: var(--q-color-white, #fff);
  border-radius: 8px;
}

.status-menu-header {
  font-size: 11px;
  font-weight: 500;
  color: var(--q-grey-6, #757575);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px 6px;
}

.status-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-menu-item {
  border-radius: 6px;
  min-height: 36px;
  padding: 4px 10px;
  transition: background-color 0.12s ease;

  :deep(.q-focus-helper) {
    border-radius: 6px;
  }

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.status-menu-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}
</style>
