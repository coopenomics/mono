<template lang="pug">
div
  BaseButton(
    variant='primary',
    aria-label='Создать проект',
    @click='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | Проект

  CreateProjectDialog(
    ref='dialogRef',
    :local='props.local',
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { CreateProjectDialog } from './Dialog';

const props = defineProps<{
  /**
   * Канал для хоткея страницы: header-action рендерится через
   * useHeaderActions (markRaw-компонент, ref снаружи недоступен),
   * поэтому страница получает openDialog через колбэк.
   */
  exposeOpen?: (fn: () => void) => void;
  /** Персональный проект без блокчейна */
  local?: boolean;
}>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();

const handleSuccess = () => {
  emit('actionCompleted');
};

onMounted(() => {
  props.exposeOpen?.(() => dialogRef.value?.openDialog());
});
</script>
