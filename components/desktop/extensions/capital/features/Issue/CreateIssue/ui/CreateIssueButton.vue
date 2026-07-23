<template lang="pug">
span(:class='{ "create-host--row": row }')
  //- Режим полнострочной «полоски-добавлялки» в конце списка (Linear-style)
  .list-add-row(
    v-if='row',
    role='button',
    tabindex='0',
    aria-label='Добавить задачу',
    @click.stop='dialogRef?.openDialog()',
    @keydown.enter.prevent='dialogRef?.openDialog()'
  )
    q-icon(name='add', size='16px')
    span Добавить задачу

  BaseButton(
    v-else,
    variant='ghost',
    :size='size ?? (mini ? "sm" : "md")',
    :loading='loading',
    :icon-only='mini',
    aria-label='Создать задачу',
    @click.stop='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    template(v-if='!mini', #default)
      | {{ label ?? 'Создать задачу' }}

  CreateIssueDialog(
    ref='dialogRef',
    :project-hash='projectHash',
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { CreateIssueDialog } from './Dialog';

defineProps<{
  mini?: boolean;
  projectHash?: string;
  /** Размер кнопки независимо от mini (для компактных строк списков) */
  size?: 'sm' | 'md';
  /** Короткая подпись для строк списков (default «Создать задачу») */
  label?: string;
  /** Полнострочная «полоска-добавлялка» в конце списка вместо кнопки */
  row?: boolean;
}>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();
const loading = ref(false);

const handleSuccess = () => {
  emit('actionCompleted');
};
</script>

<style lang="scss" scoped>
.create-host--row {
  display: block;
  width: 100%;
}

// Полнострочная «полоска-добавлялка»: muted-текст, проявляется фоном по hover
.list-add-row {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
  min-height: 40px;
  padding: var(--p-2) var(--p-3);
  box-sizing: border-box;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;

  &:hover,
  &:focus-visible {
    background-color: var(--p-surface-2);
    color: var(--p-ink-1);
    outline: none;
  }
}
</style>
