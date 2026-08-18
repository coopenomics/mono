<template lang="pug">
//- Выпадающее меню инлайн-смены значения в строке списка (статус, приоритет):
//- единый рисунок для всех чипов/иконок Благороста
q-menu(
  anchor='bottom right'
  self='top right'
  auto-close
  :offset='[0, 6]'
)
  .inline-select-menu
    .inline-select-menu__header {{ title }}
    q-list.inline-select-menu__list
      q-item.inline-select-menu__item(
        v-for='opt in options'
        :key='opt.value'
        clickable
        v-close-popup
        :active='opt.value === current'
        @click='emit("select", opt.value)'
      )
        q-item-section(avatar style='min-width: 28px')
          q-icon(
            :name='opt.icon'
            :color='opt.iconColor'
            :size='opt.iconSize || "16px"'
          )
        q-item-section
          .inline-select-menu__label {{ opt.label }}
</template>

<script setup lang="ts">
export interface InlineSelectMenuOption {
  value: string;
  label: string;
  icon: string;
  iconColor: string;
  iconSize?: string;
}

defineProps<{
  title: string;
  options: InlineSelectMenuOption[];
  current: string;
}>();

const emit = defineEmits<{
  (e: 'select', value: string): void;
}>();
</script>

<style lang="scss" scoped>
// Тот же рисунок меню, что у смены статуса задачи (IssueStatusChip)
.inline-select-menu {
  min-width: 200px;
  padding: 6px;
  background-color: var(--p-surface);
  border-radius: 8px;
}

.inline-select-menu__header {
  font-size: 11px;
  font-weight: 500;
  color: var(--p-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px 6px;
}

.inline-select-menu__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.inline-select-menu__item {
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

.inline-select-menu__label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}
</style>
