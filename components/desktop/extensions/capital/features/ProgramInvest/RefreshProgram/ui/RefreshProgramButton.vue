<template lang="pug">
q-btn(
  color='primary',
  @click='handleRefreshProgram',
  :loading='loading',
  :label='$t("capital.refreshProgramButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRefreshProgram } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { refreshProgram, refreshProgramInput } = useRefreshProgram();
const loading = ref(false);

const handleRefreshProgram = async () => {
  loading.value = true;
  try {
    await refreshProgram(refreshProgramInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
