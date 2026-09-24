<template lang="pug">
q-fab-action.bg-fab-accent-radial(
  icon="person_add"
  :label="fabLabel"
  @click="dialogRef?.openDialog()"
  text-color="white"
)
  AddAuthorDialog(
    ref="dialogRef"
    :project="project"
    @success="handleSuccess"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AddAuthorDialog } from '../Dialog';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const fabLabel = formatCapitalFabLabel(t('capital.addAuthorFabAction.label'), 'author');

const dialogRef = ref();

const handleSuccess = () => {
  emit('actionCompleted');
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
});
</script>
