<template lang="pug">
q-btn(
  size='sm',
  color='negative',
  @click='handleDeleteProject',
  :loading='loading',
  :label='$t("capital.deleteProjectButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDeleteProject } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { deleteProject, deleteProjectInput } = useDeleteProject();
const loading = ref(false);

const handleDeleteProject = async () => {
  loading.value = true;
  try {
    await deleteProject(deleteProjectInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
