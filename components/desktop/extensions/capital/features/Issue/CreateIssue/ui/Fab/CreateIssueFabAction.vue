<template lang="pug">
q-fab-action.bg-fab-accent-radial(
  icon="add"
  :label="fabLabel"
  @click="dialogRef?.openDialog()"
  text-color="white"
)
  CreateIssueDialog(
    ref="dialogRef"
    :project-hash="projectHash"
    @success="handleSuccess"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CreateIssueDialog } from '../Dialog';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

const fabLabel = formatCapitalFabLabel(t('capital.createIssueFabAction.label'), 'issue');

defineProps<{
  projectHash?: string;
}>();

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
