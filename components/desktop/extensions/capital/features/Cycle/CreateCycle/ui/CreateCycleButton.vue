<template lang="pug">
q-btn(
  color='primary',
  @click='handleCreateCycle',
  :loading='loading',
  :label='$t("capital.createCycleButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCreateCycle } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { createCycle, createCycleInput } = useCreateCycle();
const loading = ref(false);

const handleCreateCycle = async () => {
  loading.value = true;
  try {
    await createCycle(createCycleInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
