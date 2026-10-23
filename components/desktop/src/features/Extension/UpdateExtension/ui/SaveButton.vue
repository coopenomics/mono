<template lang="pug">
q-btn.full-width(
  v-if='!isEmpty',
  color='primary',
  unelevated,
  no-caps,
  @click='save',
  :loading='isSaving'
) {{ $t('common.action.save') }}
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
import { t } from 'src/shared/i18n';

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
    SuccessAlert(t('extension.saveButton.updatedSuccess'));
    router.push({ name: 'one-extension' });
  } catch (e: unknown) {
    FailAlert(
      t('extension.saveButton.saveError', { errorMessage: extractGraphQLErrorMessages(e) }),
    );
  } finally {
    isSaving.value = false;
  }
};
</script>
