<template lang="pug">
div
  BaseButton(
    variant='primary',
    :size='isMobile ? "sm" : "md"',
    aria-label='Создать задачу',
    @click='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | Задача

  CreateIssueDialog(
    ref='dialogRef',
    :project-hash='props.projectHash',
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { useWindowSize } from 'src/shared/hooks';
import { CreateIssueDialog } from './Dialog';

const props = defineProps<{
  /**
   * Канал для хоткея страницы: header-action рендерится через
   * useHeaderActions (markRaw-компонент, ref снаружи недоступен),
   * поэтому страница получает openDialog через колбэк.
   */
  exposeOpen?: (fn: () => void) => void;
  /** Если не задан — создаётся свободная задача */
  projectHash?: string;
  /** Колбэк после успешного создания (header-action не пробрасывает emit) */
  onActionCompleted?: () => void;
}>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const { isMobile } = useWindowSize();
const dialogRef = ref();

const handleSuccess = () => {
  props.onActionCompleted?.();
  emit('actionCompleted');
};

onMounted(() => {
  props.exposeOpen?.(() => dialogRef.value?.openDialog());
});
</script>
