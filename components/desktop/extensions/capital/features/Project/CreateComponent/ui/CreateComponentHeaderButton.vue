<template lang="pug">
//- Кнопка появляется, только если есть хотя бы один проект, где пайщик вправе
//- завести компонент — иначе диалог всё равно нечем заполнить
div(v-if='hasEditableProjects')
  BaseButton(
    variant='primary',
    aria-label='Создать компонент',
    @click='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | Компонент

  CreateComponentDialog(
    ref='dialogRef',
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { CreateComponentDialog } from './Dialog';
import { useEditableProjects } from '../model';

const props = defineProps<{
  /**
   * Канал для хоткея страницы: header-action рендерится через
   * useHeaderActions (markRaw-компонент, ref снаружи недоступен),
   * поэтому страница получает openDialog через колбэк.
   */
  exposeOpen?: (fn: () => void) => void;
  /** Колбэк после успешного создания (header-action не пробрасывает emit) */
  onActionCompleted?: () => void;
}>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();
const { hasEditableProjects, loadEditableProjects } = useEditableProjects();

const handleSuccess = () => {
  props.onActionCompleted?.();
  emit('actionCompleted');
};

onMounted(() => {
  void loadEditableProjects();
  props.exposeOpen?.(() => dialogRef.value?.openDialog());
});
</script>
