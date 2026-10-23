<template lang="pug">
q-btn(
  color='primary',
  @click='handleFundProgram',
  :loading='loading',
  :label='$t("capital.fundProgramButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFundProgram } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { fundProgram, fundProgramInput } = useFundProgram();
const loading = ref(false);

const handleFundProgram = async () => {
  loading.value = true;
  try {
    await fundProgram(fundProgramInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
