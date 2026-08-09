<template lang="pug">
span
  BaseButton(
    v-if='canCreateRequirement',
    variant='primary',
    size='sm',
    aria-label='Создать артефакт',
    @click.stop='dialogRef?.openDialog()'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | Артефакт

  CreateRequirementWithEditorDialog(
    ref='dialogRef',
    :filter='filter',
    @success='handleSuccess'
  )
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { CreateRequirementWithEditorDialog } from './Dialog';
import type { IIssuePermissions } from 'app/extensions/capital/entities/Issue/model';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';

const props = withDefaults(defineProps<{
  filter?: {
    project_hash?: string;
    issue_hash?: string;
  };
  permissions?: IIssuePermissions | IProjectPermissions | null;
}>(), {
  filter: undefined,
  permissions: null,
});

const emit = defineEmits<{
  actionCompleted: [];
}>();

const dialogRef = ref();

const canCreateRequirement = computed((): boolean => {
  if (!props.permissions) return false;
  return !!(props.permissions as IProjectPermissions).can_create_requirement;
});

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
</script>
