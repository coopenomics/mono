<template lang="pug">
q-btn(
  color='primary',
  @click='handleCreateExpense',
  :loading='loading',
  :label='$t("capital.createExpenseButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCreateExpense } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { createExpense, createExpenseInput } = useCreateExpense();
const loading = ref(false);

const handleCreateExpense = async () => {
  loading.value = true;
  try {
    await createExpense(createExpenseInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
