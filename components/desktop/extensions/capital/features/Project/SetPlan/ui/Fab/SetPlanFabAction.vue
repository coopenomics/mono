<template lang="pug">
q-fab-action.bg-fab-accent-radial(
  v-if="project?.permissions?.can_set_plan"
  icon="edit"
  :label="fabLabel"
  @click="dialogRef?.openDialog()"
  text-color="white"
)
  SetPlanDialog(
    ref="dialogRef"
    :project="project"
    @success="handleSuccess"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { SetPlanDialog } from '../Dialog';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

const fabLabel = formatCapitalFabLabel(t('capital.setPlanFabAction.label'), 'plan');
import type { IProject } from '../../../../../entities/Project/model';

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
