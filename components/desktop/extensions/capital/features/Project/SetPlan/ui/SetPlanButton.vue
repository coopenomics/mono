<template lang="pug">
span
  BaseButton(
    v-if="canOpenPlan"
    variant='primary'
    size='sm'
    aria-label='Установить план'
    @click.stop='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='edit', size='18px')
    | План

  SetPlanDialog(
    ref='dialogRef'
    :project='project'
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { SetPlanDialog } from './Dialog';
import type { IProject } from '../../../../entities/Project/model';

const props = defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();

/** LOCAL: финплан недоступен, цели по мерам — через can_manage_issues / can_edit_project */
const canOpenPlan = computed(() => {
  const perms = props.project?.permissions;
  if (!perms) return false;
  if (props.project?.origin === 'local') {
    return !!(perms.can_manage_issues || perms.can_edit_project);
  }
  return !!perms.can_set_plan;
});

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
</script>
