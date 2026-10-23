<template lang="pug">
q-fab-action.bg-fab-accent-radial(
  icon="add"
  :label="fabLabel"
  @click="dialogRef?.openDialog()"
  text-color="white"
)
  CreateProjectDialog(
    ref="dialogRef"
    @success="handleSuccess"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CreateProjectDialog } from '../Dialog';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

const fabLabel = formatCapitalFabLabel(t('capital.createProjectFabAction.label'), 'project');

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
