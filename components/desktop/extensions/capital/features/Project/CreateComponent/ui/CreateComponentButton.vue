<template lang="pug">
span(:class='{ "create-host--row": row }')
  //- Режим полнострочной «полоски-добавлялки» в конце списка (Linear-style)
  .list-add-row(
    v-if='row',
    role='button',
    tabindex='0',
    aria-label='Добавить компонент',
    @click.stop='handleButtonClick',
    @keydown.enter.prevent='handleButtonClick'
  )
    q-icon(name='add', size='16px')
    span Добавить компонент

  BaseButton(
    v-else,
    variant='primary',
    :size='size ?? (mini ? "sm" : "md")',
    :loading='loading',
    :icon-only='mini',
    aria-label='Создать компонент',
    @click.stop='handleButtonClick'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    template(v-if='!mini', #default)
      | Компонент

  CreateComponentDialog(
    ref="dialogRef"
    :project="project"
    @success="handleSuccess"
  )

</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { BaseButton } from 'src/shared/ui/base';
import { CreateComponentDialog } from './Dialog';

defineProps<{
  project: IProject;
  mini?: boolean;
  /** Размер кнопки независимо от mini (для компактных строк списков) */
  size?: 'sm' | 'md';
  /** Полнострочная «полоска-добавлялка» в конце списка вместо кнопки */
  row?: boolean;
}>();

const emit = defineEmits<{
  onClick: [];
}>();

const loading = ref(false);
const dialogRef = ref();

const handleButtonClick = () => {
  // Сначала отправляем событие для закрытия меню
  // Потом открываем диалог
  dialogRef.value?.openDialog();
};

const handleSuccess = () => {
  // После успешного создания компонента отправляем событие для закрытия меню
  emit('onClick');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
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
