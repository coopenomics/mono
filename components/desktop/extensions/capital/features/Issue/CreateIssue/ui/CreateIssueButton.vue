<template lang="pug">
span
  BaseButton(
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
