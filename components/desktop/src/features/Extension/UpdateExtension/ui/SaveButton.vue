<template lang="pug">
q-btn.full-width(
  v-if='!isEmpty',
  color='primary',
  unelevated,
  no-caps,
  @click='save',
  :loading='isSaving'
) Сохранить
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUpdateExtension } from '../model';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';

interface Props {
  extensionName: string;
  extensionEnabled: boolean;
  config: any;
  myFormRef?: any;
  isEmpty: boolean;
}

const props = defineProps<Props>();

const router = useRouter();
const isSaving = ref(false);

const validateForm = async () => {
  return await props.myFormRef?.value?.validate();
};

const save = async () => {
  const is_valid = await validateForm();
  if (is_valid === false) return;

  const { updateExtension } = useUpdateExtension();
  isSaving.value = true;

  try {
    await updateExtension(
      props.extensionName,
      props.extensionEnabled,
      props.config,
    );
    SuccessAlert('Расширение обновлено');
    router.push({ name: 'one-extension' });
  } catch (e: unknown) {
    FailAlert(
      `Ошибка сохранения расширения: ${extractGraphQLErrorMessages(e)}`,
    );
  } finally {
    isSaving.value = false;
  }
};
</script>
