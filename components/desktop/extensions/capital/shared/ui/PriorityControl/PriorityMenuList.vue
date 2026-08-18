<template lang="pug">
q-menu(
  anchor='bottom right'
  self='top right'
  auto-close
  :offset='[0, 6]'
)
  .priority-menu
    .priority-menu__header Сменить приоритет
    q-list.priority-menu__list
      q-item.priority-menu__item(
        v-for='opt in options'
        :key='opt.value'
        clickable
        v-close-popup
        :active='opt.value === current'
        @click='emit("select", opt.value)'
      )
        q-item-section(avatar style='min-width: 28px')
          q-icon(
            :name='getIssuePriorityIcon(opt.value)'
            :color='getIssuePriorityColor(opt.value)'
            size='16px'
          )
        q-item-section
          .priority-menu__label {{ opt.label }}
</template>

<script setup lang="ts">
import {
  ISSUE_PRIORITY_OPTIONS,
  getIssuePriorityIcon,
  getIssuePriorityColor,
} from 'app/extensions/capital/shared/lib';

defineProps<{
  current: string;
}>();

const emit = defineEmits<{
  (e: 'select', value: string): void;
}>();

const options = ISSUE_PRIORITY_OPTIONS;
</script>

<style lang="scss" scoped>
// Тот же рисунок меню, что у смены статуса задачи (IssueStatusChip)
.priority-menu {
  min-width: 200px;
  padding: 6px;
  background-color: var(--p-surface);
  border-radius: 8px;
}

.priority-menu__header {
  font-size: 11px;
  font-weight: 500;
  color: var(--p-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px 6px;
}

.priority-menu__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.priority-menu__item {
  border-radius: 6px;
  min-height: 36px;
  padding: 4px 10px;
  transition: background-color 0.12s ease;

  :deep(.q-focus-helper) {
    border-radius: 6px;
  }

  &:hover {
    background-color: var(--p-surface-2);
  }
}

.priority-menu__label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}
</style>
