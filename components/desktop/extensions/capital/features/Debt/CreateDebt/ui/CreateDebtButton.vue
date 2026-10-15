<template lang="pug">
q-btn(
  color='primary',
  @click='handleCreateDebt',
  :loading='loading',
  :label='$t("capital.createDebtButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCreateDebt } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { createDebt, createDebtInput } = useCreateDebt();
const loading = ref(false);

const handleCreateDebt = async () => {
  loading.value = true;
  try {
    await createDebt(createDebtInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
