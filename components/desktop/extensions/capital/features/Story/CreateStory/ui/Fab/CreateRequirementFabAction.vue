<template lang="pug">
q-fab-action.bg-fab-accent-radial(
  v-if="canCreateRequirement"
  icon="assignment"
  :label="fabLabel"
  @click="dialogRef?.openDialog()"
  text-color="white"
)
  CreateRequirementWithEditorDialog(
    ref="dialogRef"
    :filter="filter"
    @success="handleSuccess"
  )

</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CreateRequirementWithEditorDialog } from '../Dialog';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';

const fabLabel = formatCapitalFabLabel('Артефакт', 'requirement');
import type { IIssuePermissions } from 'app/extensions/capital/entities/Issue/model';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';

const props = withDefaults(defineProps<{
  filter?: {
    project_hash?: string;
    /** Хеш задачи — артефакт привязывается к задаче и не аккумулируется на проекте/компоненте */
    issue_hash?: string;
    /** @deprecated legacy: используйте issue_hash */
    issue_id?: string;
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

// Определяем, можем ли мы создавать артефакт
const canCreateRequirement = computed((): boolean => {
  if (!props.permissions) return false;

  // Проверяем поле can_create_requirement в зависимости от типа разрешений
  return 'can_create_requirement' in props.permissions
    ? Boolean(props.permissions.can_create_requirement)
    : false;
});

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
</script>
