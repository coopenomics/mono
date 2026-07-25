<template lang="pug">
span
  BaseButton(
    v-if="project?.permissions?.can_set_plan"
    variant='primary'
    size='sm'
    aria-label='Установить план'
    @click.stop='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='edit', size='18px')
    | Финплан

  SetPlanDialog(
    ref='dialogRef'
    :project='project'
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { SetPlanDialog } from './Dialog';
import type { IProject } from '../../../../entities/Project/model';

defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
</script>
