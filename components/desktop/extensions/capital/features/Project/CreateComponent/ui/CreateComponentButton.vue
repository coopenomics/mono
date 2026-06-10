<template lang="pug">
span
  BaseButton(
    variant='ghost',
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
</script>
