<template lang="pug">
button.create-account-button(
  @click="handleCreateAccount",
  :disabled="isLoading || !password",
  type="button"
)
  span(v-if="isLoading") {{ $t('chatcoop.createMatrixAccountButton.loadingLabel') }}
  span(v-else) {{ $t('chatcoop.createMatrixAccountButton.createLabel') }}
</template>

<script lang="ts" setup>
import { useCreateMatrixAccount } from '../model/useCreateMatrixAccount';
import { t } from '../../../../../i18n';

const props = defineProps<{
  username: string;
  password: string;
}>();

const emit = defineEmits<{
  success: [];
  error: [message: string];
}>();

const { createAccount, isLoading, error } = useCreateMatrixAccount();

const handleCreateAccount = async () => {
  const success = await createAccount(props.username, props.password);

  if (success) {
    emit('success');
  } else {
    emit('error', error.value || t('chatcoop.createMatrixAccountButton.createError'));
  }
};
</script>

<style scoped>
.create-account-button {
  padding: 0.875rem 2rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.create-account-button:hover:not(:disabled) {
  background-color: #218838;
}

.create-account-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
